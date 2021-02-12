import datetime
import uuid

from flask import g

import sqlalchemy
from sqlalchemy import create_engine, desc, TypeDecorator
from sqlalchemy import Table, MetaData, Column, DateTime, Float, Integer, LargeBinary, String
from sqlalchemy.orm import mapper, sessionmaker, deferred

from .. import models

metadata = MetaData()

class UuidColumn(TypeDecorator):
    impl = sqlalchemy.types.CHAR

    def process_bind_param(self, value, dialect):
        return str(value)


image_table = Table('image', metadata,
       Column('uuid', UuidColumn, primary_key=True),
       Column("mime_type", String(64), nullable=False),
       Column('w', Integer, nullable=False),
       Column('h', Integer, nullable=False),
       Column('original_filename', String, nullable=True),
       Column('source_url', String(1024), nullable=True),
       Column('note', String, nullable=True),
       Column('raw_data', LargeBinary, nullable=False),
       Column('when_updated', DateTime, nullable=True),
       )

image_placement_table = Table('image_placement', metadata,
        Column('uuid', UuidColumn, primary_key=True),
        Column("image_uuid", UuidColumn, nullable=False),
        Column('view_uuid', UuidColumn, nullable=False),
        Column('x', Float, nullable=False),
        Column('y', Float, nullable=False),
        Column('w', Float, nullable=False),
        Column('h', Float, nullable=False),
        Column('when_updated', DateTime, nullable=True),
        )

text_placement_table = Table('text_placement', metadata,
        Column('uuid', UuidColumn, primary_key=True),
        Column('view_uuid', UuidColumn, nullable=False),
        Column('x', Float, nullable=False),
        Column('y', Float, nullable=False),
        Column('text', String, nullable=False),
        Column('font_size_px', Integer, nullable=False),
        Column('when_updated', DateTime, nullable=True),
        )

view_table = Table('view', metadata,
        Column('uuid', UuidColumn, primary_key=True),
        Column("name", String(100), nullable=False, server_default="Unnamed"),
        Column("pan_x", Float, nullable=False),
        Column('pan_y', Float, nullable=False),
        Column('zoom', Float, nullable=False),
        Column('when_updated', DateTime, nullable=True),
        )


mapper(models.Image, image_table, properties={
    'raw_data': deferred(image_table.c.raw_data),
})
mapper(models.ImagePlacement, image_placement_table)
mapper(models.TextPlacement, text_placement_table)
mapper(models.View, view_table)


class Database:
    def __init__(self, path):
        self.engine = create_engine("sqlite:///" + str(path),
                                    echo=True
                                    )

        metadata.create_all(self.engine)

        Session = sessionmaker(bind=self.engine)
        self.session = Session()

    def close(self):
        self.session.close()

    def add_image(self, image: models.Image) -> None:
        image.when_updated = datetime.datetime.now()

        # check if already exists
        existing: models.Image = self.session.query(models.Image).filter_by(uuid=image.uuid).first()
        if existing is not None:
            existing.source_url = image.source_url
            existing.note = image.note
            existing.when_updated = image.when_updated
        else:
            self.session.add(image)

        self.session.commit()

    def add_or_update_image_placement(self, placement: models.ImagePlacement) -> None:
        placement.when_updated = datetime.datetime.now()

        # check if already exists
        existing: models.ImagePlacement = self.session.query(models.ImagePlacement).filter_by(uuid=placement.uuid).first()
        if existing is not None:
            existing.x = placement.x
            existing.y = placement.y
            existing.w = placement.w
            existing.h = placement.h
            existing.when_updated = placement.when_updated
        else:
            self.session.add(placement)

        self.session.commit()

    def add_or_update_text_placement(self, placement: models.TextPlacement) -> None:
        placement.when_updated = datetime.datetime.now()

        # check if already exists
        existing = self.session.query(models.TextPlacement).filter_by(uuid=placement.uuid).first()
        if existing is not None:
            existing.x = placement.x
            existing.y = placement.y
            existing.text = placement.text
            existing.font_size_px = placement.font_size_px
            existing.when_updated = placement.when_updated
        else:
            self.session.add(placement)

        self.session.commit()

    def add_or_update_view(self, view: models.View) -> None:
        view.when_updated = datetime.datetime.now()

        # check if already exists
        existing = self.session.query(models.View).filter_by(uuid=view.uuid).first()
        if existing is not None:
            existing.name = view.name
            existing.pan_x = view.pan_x
            existing.pan_y = view.pan_y
            existing.zoom = view.zoom
            existing.when_updated = view.when_updated
        else:
            self.session.add(view)

        self.session.commit()

    def delete_image_placement(self, uuid: uuid.UUID) -> None:
        self.session.query(models.ImagePlacement).filter_by(uuid=uuid).delete()
        self.session.commit()

    def delete_text_placement(self, uuid: uuid.UUID) -> None:
        self.session.query(models.TextPlacement).filter_by(uuid=uuid).delete()
        self.session.commit()

    def delete_view(self, uuid: uuid.UUID) -> None:
        self.session.query(models.ImagePlacement).filter_by(view_uuid=uuid).delete()
        self.session.query(models.TextPlacement).filter_by(view_uuid=uuid).delete()
        self.session.query(models.View).filter_by(uuid=uuid).delete()

        # TODO: also garbage-collect unreferenced images at this point
        self.session.commit()

    def get_all_placements_for_view(self, view: models.View) -> ([models.ImagePlacement], [models.TextPlacement]):
        images = self.session.query(models.ImagePlacement).filter_by(view_uuid=view.uuid)
        texts = self.session.query(models.TextPlacement).filter_by(view_uuid=view.uuid)

        return images.all(), texts.all()

    def get_all_views(self, ensure_some_exists: bool) -> [models.View]:
        q = self.session.query(models.View)

        if ensure_some_exists and q.count() == 0:
            view = models.View(uuid=uuid.uuid4(), name="New board", pan_x=0, pan_y=0, zoom=1,
                               when_updated=datetime.datetime.now()    # FIXME: plug in UPDATE/INSERT
                               )

            text = models.TextPlacement(uuid=uuid.uuid4(), view_uuid=view.uuid, x=0, y=0,
                                        text="Hello. This is your Zen Canvas. Why not drop some images here?",
                                        font_size_px=12, when_updated=datetime.datetime.now())

            self.session.add(view)
            self.session.add(text)
            self.session.commit()

            q = self.session.query(models.View)

        return q.all()

    def get_image_by_uuid(self, uuid: uuid.UUID) -> models.Image:
        q = self.session.query(models.Image).filter_by(uuid=uuid)
        image = q.first()
        assert image is not None
        return image

    def get_view_by_uuid(self, uuid: uuid.UUID) -> models.View:
        q = self.session.query(models.View).filter_by(uuid=uuid)
        view = q.first()
        assert view is not None
        return view

    def save_updates(self) -> None:
        self.session.commit()

def get_db():
    """Opens a new database connection if there is none yet for the
    current application context.
    """
    if not hasattr(g, 'db'):
        g.db = Database("inspired.sqlite")
    return g.db
