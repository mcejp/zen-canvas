// TODO: more rigorous state replication might be in order
// TODO: 0,0 at center
// FIXME: what if Image add request takes so long that another Update requests finishes in the meantime?

// From https://gist.github.com/ahtcx/0cd94e62691f539160b32ecda18af3d6
// Merge a `source` object to a `target` recursively
const merge = (target, source) => {
    // Iterate through `source` properties and if an `Object` set property to merge of `target` and `source` properties
    for (const key of Object.keys(source)) {
        if (source[key] instanceof Object && key in target) {
            Object.assign(source[key], merge(target[key], source[key]))
        }
    }

    // Join `target` and modified `source`
    Object.assign(target || {}, source)
    return target
}

// https://stackoverflow.com/a/2117523
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// https://stackoverflow.com/a/60804961
Promise.unwrapped = () => {
    let resolve, reject, promise = new Promise((_resolve, _reject) => {
        resolve = _resolve, reject = _reject
    })
    promise.resolve = resolve, promise.reject = reject
    return promise
}

function onBackendError() {
    // TODO
}

class ImageModel {
    /**
     * @param uuid
     * @param mimeType
     * @param w
     * @param h
     * @param originalFilename
     * @param base64Data
     */
    constructor(uuid, mimeType, w, h, originalFilename, base64Data) {
        this.uuid = uuid;
        this.mimeType = mimeType;
        this.w = w;
        this.h = h;
        this.originalFilename = originalFilename;
        this.sourceUrl = null;
        this.note = null;
        this.base64Data = base64Data;
    }
}

class ImagePlacementModel {
    /**
     * @param uuid
     * @param imageUuid
     * @param x
     * @param y
     * @param w
     * @param h
     */
    constructor(uuid, imageUuid, x, y, w, h) {
        this.uuid = uuid;
        this.imageUuid = imageUuid;
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    static from(json) {
        return Object.assign(new ImagePlacementModel(), json);
    }
}

class TextPlacementModel {
    /**
     * @param uuid
     * @param viewUuid
     * @param x
     * @param y
     * @param text
     * @param fontSizePx
     */
    constructor(uuid, viewUuid, x, y, text, fontSizePx) {
        this.uuid = uuid;
        this.viewUuid = viewUuid;
        this.x = x;
        this.y = y;
        this.text = text;
        this.fontSizePx = fontSizePx;
    }

    static from(json) {
        return Object.assign(new TextPlacementModel(), json);
    }
}

// class ThrottledRequest {
//     constructor(minInterval) {
//         this.interval = minInterval;
//         this.lastTime = null;
//         this.scheduledRequest = null;
//     }
//
//     submit(request) {
//
//     }
// }

class Backend {
    minPushInterval = 2000;
    updateLastTime = null;

    scheduledUpdateData = null;

    addOrUpdateTextPlacement(placement) {
        this.updateModel({
            textPlacements: {
                [placement.uuid]: placement
            }
        });
    }

    async getModel() {
        const response = await fetch("model")

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const model = await response.json();
        console.log(model);

        return model;
    }

    deleteImagePlacement(uuid) {
        const promise = fetch("imagePlacement", {
            method: "DELETE",
            body: JSON.stringify({uuid: uuid}),
            headers: {
                'Content-Type': 'application/json'
            },
        });
    }

    deleteTextPlacement(uuid) {
        const promise = fetch("textPlacement", {
            method: "DELETE",
            body: JSON.stringify({uuid: uuid}),
            headers: {
                'Content-Type': 'application/json'
            },
        });
    }

    // FIXME: make sure we do not keep uploading the image over and over!
    updateImage(image) {
        this.updateModel({
            images: {
                [image.uuid]: image,
            }
        })
    }

    updateModel(changes) {
        let sendDelay;
        // console.log(changes, "VS", this.scheduledUpdateData)
        if (this.scheduledUpdateData !== null) {
            merge(this.scheduledUpdateData, changes)
            // console.log("Merged update =>", this.scheduledUpdateData);
            return;
        }
        else if (this.updateLastTime !== null &&  (new Date() - this.updateLastTime) < this.minPushInterval) {
            // update scheduled recently,
            sendDelay = (this.updateLastTime - new Date()) + this.minPushInterval;
            // console.log("recently =>", sendDelay);
        }
        else {
            console.log("ok, its been", new Date() - this.updateLastTime)
            // update not scheduled recently/ever
            sendDelay = this.minPushInterval;
        }

        this.scheduledUpdateData = changes;

        window.setTimeout(() => {
            this._doUpdateModel(this.scheduledUpdateData);
        }, sendDelay)
    }

    _doUpdateModel(changeset) {
        const promise = fetch("model", {
            method: "POST",
            body: JSON.stringify(changeset),
            headers: {
                'Content-Type': 'application/json'
            },
        });

        // TODO: if it fails, re-submit changeset next time
        promise.catch((reason => { console.log("o kurwa", reason); }));
        promise.then((result => { console.log("o dobrze", result); }));

        this.updateLastTime = new Date();
        this.scheduledUpdateData = null;
    }
}

class Canvas {
    selection = null;

    clientX = undefined;
    clientY = undefined;

    defaultFontSizePx = 14;

    constructor(canvasDiv, backend, modelInitial) {
        this.div = canvasDiv;

        this.backend = backend;

        this.view = modelInitial.view;

        this.panzoom = panzoom(this.div, {
            // maxScale: 5
            beforeMouseDown: function(e) {
                const middleMouseButton = 1;
                const shouldIgnore = (e.button !== middleMouseButton);
                return shouldIgnore;
            },

            filterKey: function(e, dx, dy, dz) {
                let shouldIgnore = false;
                // TODO: this should be improved to instead checking if target is a child of UI
                if (e.target.tagName.toLowerCase() === "input" || e.target.tagName.toLowerCase() === "textarea") {
                    shouldIgnore = true;
                }
                return shouldIgnore;
            }
        })

        this.panzoom.zoomAbs(0, 0, modelInitial.view.zoom);
        this.panzoom.moveTo(modelInitial.view.panX, modelInitial.view.panY);

        // Stream view updates to back-end
        this.panzoom.on('transform', (e) => {
            this._saveTransform(e.getTransform());
        });

        for (const [uuid, placement] of Object.entries(modelInitial.imagePlacements)) {
            const image = modelInitial.images[placement.imageUuid];
            this._addImagePlacement(ImagePlacementModel.from(placement), image, null)
        }

        for (const placement of Object.values(modelInitial.textPlacements)) {
            this._addTextPlacement(TextPlacementModel.from(placement))
        }

        document.addEventListener("keyup", (ev) => {
            if (ev.target.tagName.toLowerCase() === "input") {
                return;
            }

            const shortcuts = {
                // delete selected
                Delete: (ev) =>     this._deleteSelection(),
                // clear selection
                Escape: (ev) =>     this._select(null),
                // scale selection up
                PageUp: (ev) =>     this._resizeSelection(1),
                // scale selection down
                PageDown: (ev) =>   this._resizeSelection(-1),
                // insert Text object
                t: (ev) =>          this._addTextAtMouse("Click to edit me!"),
            }

            if (shortcuts.hasOwnProperty(ev.key)) {
                shortcuts[ev.key](ev);
                console.log("handled", ev);
            }
        });

        document.addEventListener("mousemove", (ev) => {
            [this.clientX, this.clientY] = [ev.clientX, ev.clientY];
        });
    }

    addImageFromDataUrl(clientX, clientY, mimeType, originalFilename, dataUrl) {
        // console.log("drop at", clientX, clientY);
        const [absX, absY] = this._clientToCanvasCoords(clientX, clientY);

        const img = document.createElement("img");
        img.className = "image-placement";
        img.style.left = `${absX}px`;
        img.style.top =  `${absY}px`;
        img.src = dataUrl;
        this.div.appendChild(img);

        img.addEventListener("load", () => {
            // create models
            // TODO: de-duplicate images
            const base64Data = dataUrl.substr(dataUrl.indexOf(",") + 1)

            const image = new ImageModel(uuidv4(), mimeType, img.naturalWidth, img.naturalHeight, originalFilename, base64Data);
            const placement = new ImagePlacementModel(uuidv4(), image.uuid, absX, absY, image.w, image.h);

            this.backend.updateModel({
                images: {
                    [image.uuid]: image
                },
                imagePlacements: {
                    [placement.uuid]: placement
                }
            });

            this._addImagePlacement(placement, image, img);
        })
    }

    _addImagePlacement(placement, image, img) {
        if (!img) {
            img = document.createElement("img");
            img.className = "image-placement";
            img.style.left = `${placement.x}px`;
            img.style.top = `${placement.y}px`;
            img.src = `image/${placement.imageUuid}`;
            this.div.appendChild(img);
        }
        else {
            // pre-existing <img> tag, proceed with setting up interactivity
        }

        img.style.width = `${placement.w}px`;
        img.style.height = `${placement.h}px`;

        interact(img).draggable({
            listeners: {
                start (event) {
                    // console.log(event.type, event.target)
                },
                move: (event) => {
                    placement.x = parseInt(event.target.style.left) + event.dx / this.panzoom.getTransform().scale;
                    placement.y = parseInt(event.target.style.top) + event.dy / this.panzoom.getTransform().scale;

                    event.target.style.top = `${placement.y}px`
                    event.target.style.left = `${placement.x}px`

                    this.backend.updateModel({
                        imagePlacements: { [placement.uuid]: placement }
                    });
                },
            }
        })

        img.addEventListener("mousedown", (ev) => {
            this._select(img, placement, {image: image})
        })
    }

    _addTextPlacement(placement) {
        const element = document.createElement("div");
        element.className = "text-placement";
        element.style.left = `${placement.x}px`;
        element.style.top = `${placement.y}px`;
        element.style.fontSize = `${placement.fontSizePx}px`;
        element.innerText = placement.text;
        this.div.appendChild(element);

        interact(element).draggable({
            listeners: {
                start (event) {
                    // console.log(event.type, event.target)
                },
                move: (event) => {
                    placement.x = parseInt(event.target.style.left) + event.dx / this.panzoom.getTransform().scale;
                    placement.y = parseInt(event.target.style.top) + event.dy / this.panzoom.getTransform().scale;

                    event.target.style.top = `${placement.y}px`
                    event.target.style.left = `${placement.x}px`

                    this.backend.addOrUpdateTextPlacement(placement);
                },
            }
        })

        element.addEventListener("mousedown", (ev) => {
            this._select(element, placement)
        })
    }

    _addTextAtMouse(text) {
        if (this.clientX === undefined || this.clientY === undefined) {
            console.log("Warning: no client x,y");
            return;
        }

        const [absX, absY] = this._clientToCanvasCoords(this.clientX, this.clientY);

        const placement = new TextPlacementModel(uuidv4(), this.view.uuid, absX, absY, text, this.defaultFontSizePx);
        this._addTextPlacement(placement);

        this.backend.addOrUpdateTextPlacement(placement);
    }

    _clientToCanvasCoords(clientX, clientY) {
        // x_client = x_transform + x_DOM * scale
        // x_DOM = (x_client - x_transform) / scale

        // calculate position within canvas, considering the pan & zoom
        const {x: panX, y: panY, scale} = this.panzoom.getTransform();

        const absX = (clientX - panX) / scale;
        const absY = (clientY - panY) / scale;

        return [absX, absY];
    }

    _deleteSelection() {
        if (this.selection !== null) {
            this.selection.element.remove();

            if (this.selection.placement instanceof ImagePlacementModel) {
                this.backend.deleteImagePlacement(this.selection.placement.uuid);
            }
            else if (this.selection.placement instanceof TextPlacementModel) {
                this.backend.deleteTextPlacement(this.selection.placement.uuid);
            }

            this.selection = null;
        }
    }

    _resizeSelection(sign) {
        if (this.selection !== null) {
            if (this.selection.placement instanceof ImagePlacementModel) {
                const factor = Math.exp(sign * 0.2);
                const placement = this.selection.placement;

                placement.w *= factor;
                placement.h *= factor;

                this.selection.element.style.width = `${placement.w}px`;
                this.selection.element.style.height = `${placement.h}px`;

                this.backend.updateModel({
                    imagePlacements: { [placement.uuid]: placement }
                });
            }
            else if (this.selection.placement instanceof TextPlacementModel) {
                const placement = this.selection.placement;

                // chosen because 10px * exp(0.14) rounds to 12px
                placement.fontSizePx = Math.round(placement.fontSizePx * Math.exp(sign * 0.14));

                this.selection.element.style.fontSize = `${placement.fontSizePx}px`;

                this.backend.addOrUpdateTextPlacement(placement);
            }
        }
    }

    _saveTransform(transform) {
        this.view.panX = transform.x;
        this.view.panY = transform.y;
        this.view.zoom = transform.scale;

        this.backend.updateModel({
            view: this.view,
        })
    }

    _select(element, placement, extras) {
        const uiContent = document.getElementById("ui-content")

        if (this.selection !== null) {
            this.selection.element.classList.remove("selected")
            uiContent.innerHTML = "";
        }

        if (element !== null) {
            element.classList.add("selected")
            this.selection = {element: element, placement: placement}

            if (placement instanceof ImagePlacementModel) {
                const editor = document.getElementById("image-placement-editor").cloneNode(true);
                uiContent.appendChild(editor);

                const image = extras.image;

                const bindImageProperty = (selector, attributeName) => {
                    const input = editor.querySelector(selector);
                    console.log(image, attributeName);
                    input.value = image[attributeName];

                    input.addEventListener("input", (ev) => {
                        image[attributeName] = input.value;
                        this.backend.updateImage(image);
                    })
                };

                bindImageProperty('[data-id="original-filename"]', "originalFilename");
                bindImageProperty('[data-id="source-url"]', "sourceUrl");
                bindImageProperty('[data-id="note"]', "note");
            }
            else if (placement instanceof TextPlacementModel) {
                const editor = document.getElementById("text-placement-editor").cloneNode(true);
                uiContent.appendChild(editor);

                const input = editor.querySelector("input");
                input.value = placement.text;

                input.addEventListener("input", (ev) => {
                    placement.text = input.value;
                    element.innerText = placement.text;
                    this.backend.addOrUpdateTextPlacement(placement)
                })
            }
        }
        else {
            this.selection = null;
        }
    }
}

window.addEventListener("load", () => {
    const backend = new Backend();

    const tabBar = new TabBar(document.getElementById("tab-bar"), {
        // withCloseButton: true,
        // newTabButton: true,
    });

    backend.getModel().then((model) => {
        const container = document.getElementById("thecontainer");

        const placeholder = document.getElementById("placeholder");
        placeholder.remove();

        const canvasDiv = document.getElementById("thecanvas")

        const canvas = new Canvas(canvasDiv, backend, model);

        container.ondrop = (ev) => {
            console.log('File(s) dropped');

            // Prevent default behavior (Prevent file from being opened)
            ev.preventDefault();

            if (ev.dataTransfer.items) {
                // Use DataTransferItemList interface to access the file(s)
                for (var i = 0; i < ev.dataTransfer.items.length; i++) {
                    // If dropped items aren't files, reject them
                    if (ev.dataTransfer.items[i].kind === 'file') {
                        const file = ev.dataTransfer.items[i].getAsFile();
                        console.log('A:... file[' + i + '].name = ' + file.name);

                        if (file.type === "image/gif" || file.type === "image/jpeg" || file.type === "image/png") {
                            var reader = new FileReader();

                            reader.onload = (ev2) => {
                                canvas.addImageFromDataUrl(ev.clientX, ev.clientY, file.type, file.name, ev2.target.result);
                            };
                            reader.onerror = (ev) => {
                                console.log("Reader error", ev);
                            }

                            reader.readAsDataURL(file);
                        } else {
                            console.log("Unhandled" + file.type)
                        }
                    }
                }
            } else {
                // Use DataTransfer interface to access the file(s)
                for (var i = 0; i < ev.dataTransfer.files.length; i++) {
                    console.log('B:... file[' + i + '].name = ' + ev.dataTransfer.files[i].name);
                }
            }
        };

        container.ondragover = (ev) => {
            console.log('File(s) in drop zone');

            // Prevent default behavior (Prevent file from being opened)
            ev.preventDefault();
        }

        tabBar.setModel({tabs:
            model.views.map((view) => ({title: view.name})),
        });
    })
})
