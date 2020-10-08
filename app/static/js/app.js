// TODO: more rigorous state replication might be in order
// TODO: 0 at center

// From https://gist.github.com/ahtcx/0cd94e62691f539160b32ecda18af3d6
// Merge a `source` object to a `target` recursively
const merge = (target, source) => {
    // Iterate through `source` properties and if an `Object` set property to merge of `target` and `source` properties
    for (const key of Object.keys(source)) {
        if (source[key] instanceof Object) Object.assign(source[key], merge(target[key], source[key]))
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

class ImageModel {
    constructor(uuid, mime_type, w, h, data) {
        this.uuid = uuid;
        this.mime_type = mime_type;
        this.w = w;
        this.h = h;
        this.data = data;
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
    constructor() {
        this.minPushInterval = 2000;
        this.updateLastTime = null;

        this.scheduledUpdateData = null;
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

    // imagePut

    updateModel(changes) {
        let sendDelay;

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
    constructor(canvasDiv, backend, modelInitial) {
        this.div = canvasDiv;
        this.div.appendChild(document.createTextNode("Hello. This is your Zen Canvas."));

        this.backend = backend;

        this.panzoom = panzoom(this.div, {
            // maxScale: 5
        })

        this.panzoom.zoomAbs(0, 0, modelInitial.viewTransform.zoom);
        this.panzoom.moveTo(modelInitial.viewTransform.pan_x, modelInitial.viewTransform.pan_y);

        // Stream view updates to back-end
        this.panzoom.on('transform', (e) => { this._saveTransform(e.getTransform()); });

        for (const [uuid, placement] of Object.entries(modelInitial.imagePlacements)) {
            const image = modelInitial.images[placement.imageUuid];
            this.addImagePlacement(placement, image)
        }
    }

    addImagePlacement(placement, image) {
        const img = document.createElement("img");
        img.style.position = "absolute";
        img.style.left = `${placement.x}px`;
        img.style.top =  `${placement.y}px`;
        img.style.width = `${placement.w}px`;
        img.style.height = `${placement.h}px`;
        img.src = image.data;
        this.div.appendChild(img);
    }

    addImageFromDataUrl(clientX, clientY, mimeType, data) {
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
        img.src = data;
        this.div.appendChild(img);

        img.addEventListener("load", () => {
            // create models
            // TODO: de-duplication of resources
            const imageModel = new ImageModel(uuidv4(), mimeType, img.naturalWidth, img.naturalHeight, data);
            const placementModel = new ImagePlacementModel(uuidv4(), imageModel.uuid, absX, absY, imageModel.w, imageModel.h);

            this.backend.updateModel({
                images: {
                    [imageModel.uuid]: imageModel
                },
                imagePlacements: {
                    [placementModel.uuid]: placementModel
                }
            });
        })
    }

    _saveTransform(transform) {
        this.backend.updateModel({
            viewTransform: {pan_x: transform.x, pan_y: transform.y, zoom: transform.scale},
        })
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
                        var file = ev.dataTransfer.items[i].getAsFile();
                        console.log('A:... file[' + i + '].name = ' + file.name);

                        if (file.type === "image/jpeg" || file.type === "image/png") {
                            var reader = new FileReader();
                            const mimeType = file.type;

                            reader.onload = (ev2) => {
                                // Should look like data:,<jibberish_data> based on which method you called
                                // console.log(ev2.target.result);
                                canvas.addImageFromDataUrl(ev.clientX, ev.clientY, mimeType, ev2.target.result);
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
