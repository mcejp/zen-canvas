import io
from uuid import UUID

from flask import g, render_template, request, Blueprint, send_file

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

    views = db.get_all_views(True)

    ret = dict(images={},
               imagePlacements={},
               textPlacements={},
               views=[view_.to_json() for view_ in views]
               )

    image_placements, text_placements = db.get_all_placements_for_view(views[0])

    for p in image_placements:
        ret["imagePlacements"][p.uuid] = p.to_json()

        # add image metadata
        image = db.get_image_by_uuid(p.image_uuid)
        ret["images"][image.uuid] = image.to_json()

    for p in text_placements:
        ret["textPlacements"][p.uuid] = p.to_json()

    return ret


@main.route('/model', methods=['POST'])
def post_model():
    # print("REQUEST", request.json)
    db = get_db()

    # process updates
    for key, value in request.get_json().items():
        # print(key, "=>", value)
        if key == "images":
            for uuid, model in value.items():
                image = models.Image.from_json(model)
                db.add_image(image)
        elif key == "imagePlacements":
            for uuid, model in value.items():
                placement = models.ImagePlacement.from_json(model)
                db.add_or_update_image_placement(placement)
        elif key == "textPlacements":
            for uuid, model in value.items():
                placement = models.TextPlacement.from_json(model)
                db.add_or_update_text_placement(placement)
        elif key == "views":
            for uuid, model in value.items():
                view = models.View.from_json(model)
                db.add_or_update_view(view)
    return dict()


@main.route('/imagePlacement', methods=['DELETE'])
def delete_image_placement():
    db = get_db()
    db.delete_image_placement(UUID(request.json["uuid"]))

    return dict()

@main.route('/textPlacement', methods=['DELETE'])
def delete_text_placement():
    db = get_db()
    db.delete_text_placement(UUID(request.json["uuid"]))

    return dict()

@main.route('/image/<uuid>')
def get_image(uuid):
    db = get_db()
    image = db.get_image_by_uuid(uuid)

    return send_file(io.BytesIO(image.raw_data),
                     # as_attachment=True,
                     # attachment_filename=image.original_filename,
                     mimetype=image.mime_type,
                     cache_timeout=365 * 24 * 3600,     # cache up to a year
                                                        # this is not the best, because it does not set the new
                                                        # `Cache-Control: immutable` flag
                     )


@main.route('/view/<uuid>', methods=['GET'])
def get_view(uuid):
    db = get_db()

    view = db.get_view_by_uuid(UUID(uuid))

    ret = dict(images={},
               imagePlacements={},
               textPlacements={},
               view=view.to_json(),
               )

    image_placements, text_placements = db.get_all_placements_for_view(view)

    for p in image_placements:
        ret["imagePlacements"][p.uuid] = p.to_json()

        # add image metadata
        image = db.get_image_by_uuid(p.image_uuid)
        ret["images"][image.uuid] = image.to_json()

    for p in text_placements:
        ret["textPlacements"][p.uuid] = p.to_json()

    return ret
