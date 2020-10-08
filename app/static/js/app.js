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
    constructor(uuid, mimeType, w, h, originalFilename, base64Data) {
        this.uuid = uuid;
        this.mimeType = mimeType;
        this.w = w;
        this.h = h;
        this.originalFilename = originalFilename;
        this.base64Data = base64Data;
    }
}

class ImagePlacementModel {
    constructor(uuid, imageUuid, x, y, w, h) {
        this.uuid = uuid;
        this.imageUuid = imageUuid;
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
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

    constructor(canvasDiv, backend, modelInitial) {
        this.div = canvasDiv;
        this.div.appendChild(document.createTextNode("Hello. This is your Zen Canvas. Drop some images here!"));

        this.backend = backend;

        this.panzoom = panzoom(this.div, {
            // maxScale: 5
            beforeMouseDown: function(e) {
                const middleMouseButton = 1;
                const shouldIgnore = (e.button !== middleMouseButton);
                return shouldIgnore;
            }
        })

        this.panzoom.zoomAbs(0, 0, modelInitial.viewTransform.zoom);
        this.panzoom.moveTo(modelInitial.viewTransform.pan_x, modelInitial.viewTransform.pan_y);

        // Stream view updates to back-end
        this.panzoom.on('transform', (e) => {
            this._saveTransform(e.getTransform());
        });

        for (const [uuid, placement] of Object.entries(modelInitial.imagePlacements)) {
            const image = modelInitial.images[placement.imageUuid];
            this._addImagePlacement(placement, image, null)
        }

        document.addEventListener("keyup", (ev) => {
            if(ev.key === "Delete") {
                this._deleteSelection();
            }
            else if(ev.key === "Escape") {
                this._select(null);
            }
            else if(ev.key === "PageUp") {
                this._resizeSelection(1);
            }
            else if(ev.key === "PageDown") {
                this._resizeSelection(-1);
            }
        });
    }

    addImageFromDataUrl(clientX, clientY, mimeType, originalFilename, dataUrl) {
        // x_client = x_transform + x_DOM * scale
        // x_DOM = (x_client - x_transform) / scale
        // console.log("drop at", clientX, clientY);

        // calculate position within canvas, considering the pan & zoom
        const {x: panX, y: panY, scale} = this.panzoom.getTransform();

        const absX = (clientX - panX) / scale;
        const absY = (clientY - panY) / scale;

        const img = document.createElement("img");
        img.style.position = "absolute";
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
            img.style.position = "absolute";
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

        img.style.touchAction = "none"

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
            this._select(img, placement)
        })
    }

    _deleteSelection() {
        if (this.selection !== null) {
            this.selection.img.remove();
            this.backend.deleteImagePlacement(this.selection.placement.uuid);
            this.selection = null;
        }
    }

    _resizeSelection(sign) {
        if (this.selection !== null) {
            const factor = Math.exp(sign * 0.2);
            const placement = this.selection.placement;

            placement.w *= factor;
            placement.h *= factor;

            this.selection.img.style.width = `${placement.w}px`;
            this.selection.img.style.height = `${placement.h}px`;

            this.backend.updateModel({
                imagePlacements: { [placement.uuid]: placement }
            });
        }
    }

    _saveTransform(transform) {
        this.backend.updateModel({
            viewTransform: {pan_x: transform.x, pan_y: transform.y, zoom: transform.scale},
        })
    }

    _select(img, placement) {
        if (this.selection !== null) {
            this.selection.img.classList.remove("selected")
        }

        if (img !== null) {
            img.classList.add("selected")
            this.selection = {img: img, placement: placement}
        }
        else {
            this.selection = null;
        }
    }
}

window.addEventListener("load", () => {
    const backend = new Backend();

    backend.getModel().then((model) => {
        const container = document.getElementById("thecontainer");

        const placeholder = document.getElementById("placeholder");
        placeholder.remove();

        // const canvasDiv = document.createElement("div");
        // canvasDiv.id = "thecanvas";
        // container.appendChild(canvasDiv)
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
    })
})
