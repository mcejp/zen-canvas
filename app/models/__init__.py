import base64
from dataclasses import dataclass
import datetime
from typing import Optional
from uuid import UUID


# watch out, SQLalchemy is buggy for dataclass with default values


@dataclass
class View:
    uuid: UUID
    name: str
    pan_x: float
    pan_y: float
    zoom: float
    when_updated: Optional[datetime.datetime]

    @staticmethod
    def from_json(model):
        return View(uuid=UUID(model["uuid"]), name=model["name"],
                    pan_x=model["panX"], pan_y=model["panY"], zoom=model["zoom"],
                    when_updated=None)

    def to_json(self):
        return dict(uuid=str(self.uuid), name=self.name, panX=self.pan_x, panY=self.pan_y, zoom=self.zoom)

@dataclass
class Image:
    uuid: UUID
    mime_type: str
    w: int
    h: int
    original_filename: Optional[str]
    source_url: Optional[str]
    note: Optional[str]
    raw_data: Optional[bytes]
    when_updated: Optional[datetime.datetime]

    @staticmethod
    def from_json(model):
        return Image(uuid=UUID(model["uuid"]),
                     mime_type=model["mimeType"],
                     w=model["w"],
                     h=model['h'],
                     original_filename=model["originalFilename"],
                     source_url=model["sourceUrl"],
                     note=model["note"],
                     raw_data=base64.b64decode(model["base64Data"].encode()) if "base64Data" in model else None,
                     when_updated=None)

    def to_json(self):
        return dict(uuid=self.uuid, mimeType=self.mime_type, w=self.w, h=self.h,
                    originalFilename=self.original_filename, sourceUrl=self.source_url, note=self.note)

@dataclass
class ImagePlacement:
    uuid: UUID
    image_uuid: UUID
    view_uuid: UUID
    x: float
    y: float
    w: float
    h: float
    when_updated: Optional[datetime.datetime]

    @staticmethod
    def from_json(model):
        return ImagePlacement(UUID(model["uuid"]), UUID(model["imageUuid"]), UUID(model["viewUuid"]),
                              model["x"], model['y'], model["w"], model['h'],
                              when_updated=None)

    def to_json(self):
        return dict(uuid=str(self.uuid), imageUuid=str(self.image_uuid), viewUuid=str(self.view_uuid),
                    x=self.x, y=self.y, w=self.w, h=self.h)

@dataclass
class TextPlacement:
    uuid: UUID
    view_uuid: UUID
    x: float
    y: float
    text: str
    font_size_px: int
    when_updated: Optional[datetime.datetime]

    @staticmethod
    def from_json(model):
        return TextPlacement(UUID(model["uuid"]), UUID(model["viewUuid"]),
                             model["x"], model['y'], model["text"], model['fontSizePx'],
                             when_updated=None)

    def to_json(self):
        return dict(uuid=str(self.uuid), viewUuid=str(self.view_uuid),
                    x=self.x, y=self.y, text=self.text, fontSizePx=self.font_size_px)
