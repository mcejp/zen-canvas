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
    data: str
    when_updated: Optional[datetime.datetime]


@dataclass
class ImagePlacement:
    uuid: uuid.UUID
    image_uuid: uuid.UUID
    x: float
    y: float
    w: float
    h: float
    when_updated: Optional[datetime.datetime]
