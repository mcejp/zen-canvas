import uuid

from flask import g, render_template, request, Blueprint

from app.main.database import get_db
from .. import models

main = Blueprint(
    'main',
    __name__,
    template_folder='templates/main',
    url_prefix='/'
)


@main.route('/', methods=['GET'])
def index():
    return render_template('main/index.html')


@main.route('/model', methods=['GET'])
def get_model():
    db = get_db()

    view = db.get_some_view()
    print(view)

    ret = dict(images={},
               imagePlacements={},
               viewTransform=dict(pan_x=view.pan_x, pan_y=view.pan_y, zoom=view.zoom)
               )

    placements = db.get_all_placements_for_view(view)

    for p in placements:
        if isinstance(p, models.ImagePlacement):
            ret["imagePlacements"][p.uuid] = dict(uuid=p.uuid, imageUuid=p.image_uuid, x=p.x, y=p.y, w=p.w, h=p.h)

            # fetch image
            image = db.get_image_by_uuid(uuid.UUID(p.image_uuid))
            ret["images"][image.uuid] = dict(uuid=image.uuid, data=image.data)

    return ret

@main.route('/model', methods=['POST'])
def post_model():
    print("REQUEST", request.json)
    db = get_db()

    # process updates
    for key, value in request.get_json().items():
        # print(key, "=>", value)
        if key == "images":
            for uuid, model in value.items():
                image = models.Image(**model, when_updated=None)
                db.add_image(image)
        elif key == "imagePlacements":
            for uuid, model in value.items():
                placement = models.ImagePlacement(uuid=model["uuid"],
                                                  image_uuid=model["imageUuid"],
                                                  x=model["x"],
                                                  y=model["y"],
                                                  w=model["w"],
                                                  h=model["h"],
                                                  when_updated=None)
                db.add_or_update_image_placement(placement)
        elif key == "viewTransform":
            # find a view, since we don't handle it properly now
            view = db.get_some_view()
            view.pan_x = value["pan_x"]
            view.pan_y = value["pan_y"]
            view.zoom = value["zoom"]
            db.save_updates()

    return dict()
