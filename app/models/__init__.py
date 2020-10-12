import base64
from dataclasses import dataclass
import datetime
from typing import Optional
import uuid


# watch out, SQLalchemy is buggy for dataclass with default values


@dataclass
class View:
    uuid: uuid.UUID
    pan_x: float
    pan_y: float
    zoom: float
    when_updated: Optional[datetime.datetime]


@dataclass
class Image:
    uuid: uuid.UUID
    mime_type: str
    w: int
    h: int
    original_filename: str
    raw_data: Optional[bytes]
    when_updated: Optional[datetime.datetime]

    @staticmethod
    def from_json(model):
        return Image(uuid.UUID(model["uuid"]),
                     model["mimeType"],
                     model["w"],
                     model['h'],
                     model["originalFilename"],
                     raw_data=base64.b64decode(model["base64Data"].encode()),
                     when_updated=None)

    def to_json(self):
        return dict(uuid=self.uuid, mimeType=self.mime_type, w=self.w, h=self.h)

@dataclass
class ImagePlacement:
    uuid: uuid.UUID
    image_uuid: uuid.UUID
    x: float
    y: float
    w: float
    h: float
    when_updated: Optional[datetime.datetime]

    @staticmethod
    def from_json(model):
        return ImagePlacement(uuid.UUID(model["uuid"]), uuid.UUID(model["imageUuid"]),
                              model["x"], model['y'], model["w"], model['h'],
                              when_updated=None)

@dataclass
class TextPlacement:
    uuid: uuid.UUID
    view_uuid: uuid.UUID
    x: float
    y: float
    text: str
    font_size_px: int
    when_updated: Optional[datetime.datetime]

    @staticmethod
    def from_json(model):
        return TextPlacement(uuid.UUID(model["uuid"]), uuid.UUID(model["viewUuid"]),
                             model["x"], model['y'], model["text"], model['fontSizePx'],
                             when_updated=None)

    def to_json(self):
        return dict(uuid=str(self.uuid), viewUuid=str(self.view_uuid),
                    x=self.x, y=self.y, text=self.text, fontSizePx=self.font_size_px)
