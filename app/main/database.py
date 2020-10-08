import datetime
import uuid

from flask import g

import sqlalchemy
from sqlalchemy import create_engine, desc, TypeDecorator
from sqlalchemy import Table, MetaData, Column, DateTime, Float, Integer, String
from sqlalchemy.orm import mapper, sessionmaker
from sqlalchemy.types import CHAR

from .. import models

metadata = MetaData()

class UuidColumn(TypeDecorator):
    """Safely coerce Python bytestrings to Unicode
    before passing off to the database."""

    impl = CHAR

    def process_bind_param(self, value, dialect):
        return str(value)


image_table = Table('image', metadata,
       Column('uuid', UuidColumn, primary_key=True),
       Column("mime_type", String(64), nullable=False),
       Column('w', Integer, nullable=False),
       Column('h', Integer, nullable=False),
       Column('data', String, nullable=False),
       Column('when_updated', DateTime, nullable=True),
       )

image_placement_table = Table('image_placement', metadata,
        Column('uuid', UuidColumn, primary_key=True),
        Column("image_uuid", UuidColumn, nullable=False),
        Column('x', Float, nullable=False),
        Column('y', Float, nullable=False),
        Column('w', Float, nullable=False),
        Column('h', Float, nullable=False),
        Column('when_updated', DateTime, nullable=True),
        )

view_table = Table('view', metadata,
        Column('uuid', UuidColumn, primary_key=True),
        Column("pan_x", Float, nullable=False),
        Column('pan_y', Float, nullable=False),
        Column('zoom', Float, nullable=False),
        Column('when_updated', DateTime, nullable=True),
        )


mapper(models.Image, image_table)
mapper(models.ImagePlacement, image_placement_table)
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
        self.session.add(image)
        self.session.commit()

    def add_or_update_image_placement(self, placement: models.ImagePlacement) -> None:
        placement.when_updated = datetime.datetime.now()
        self.session.add(placement)

        try:
            self.session.commit()
        except sqlalchemy.exc.IntegrityError as ex:
            # print(repr(str(ex.orig)))
            if "UNIQUE constraint failed" in str(ex.orig):
                image_placement_table.update().where(image_placement_table.c.uuid == placement.uuid). \
                    values(image_uuid=placement.image_uuid,
                           x=placement.x,
                           y=placement.y,
                           w=placement.w,
                           h=placement.h,
                           when_updated=placement.when_updated)
                self.session.commit()
            else:
                raise
        finally:
            self.session.rollback()

    def get_all_placements_for_view(self, view: models.View) -> [models.ImagePlacement]:
        # TODO: filter on view (once implemented)

        q = self.session.query(models.ImagePlacement)
        return q.all()

    def get_image_by_uuid(self, uuid: uuid.UUID) -> models.Image:
        q = self.session.query(models.Image).filter_by(uuid=uuid)
        image = q.first()
        assert image is not None
        return image

    def get_some_view(self) -> models.View:
        q = self.session.query(models.View)

        if q.count() == 0:
            view = models.View(uuid=uuid.uuid4(), pan_x=0, pan_y=0, zoom=1,
                        when_updated=datetime.datetime.now()    # FIXME: plug in UPDATE/INSERT
                        )
            self.session.add(view)
            self.session.commit()

            # TODO: put sumthin innit!

            q = self.session.query(models.View)

        return q.first()

    def save_updates(self) -> None:
        self.session.commit()

def get_db():
    """Opens a new database connection if there is none yet for the
    current application context.
    """
    # FIXME: teardown per https://flask.palletsprojects.com/en/0.12.x/tutorial/dbcon/
    if not hasattr(g, 'db'):
        g.db = Database("inspired.sqlite")
    return g.db
