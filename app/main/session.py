import logging
import tempfile
from multiprocessing import Lock
from pathlib import Path
from random import randrange
from typing import Optional

import appdirs
import yaml

logger = logging.getLogger(__name__)


class Config:
    def __init__(self):
        self._lock = Lock()
        self._data = None

        # TODO: ensure this is in sync with the Electron side of things
        self._config_dir = Path(appdirs.user_config_dir(appname="zen-canvas", appauthor="com.mcejp", roaming=True))
        logger.debug("config dir=%s", self._config_dir)

    def get_most_recent_file_path(self) -> Optional[str]:
        with self._lock:
            self._ensure_config_loaded()
            return self._data.get("recent-file", None)

    def _ensure_config_loaded(self) -> None:
        if self._data is None:
            try:
                with open(self._config_dir / "zen-canvas.config.yml", "rt") as f:
                    self._data = yaml.safe_load(f)

                assert isinstance(self._data, dict)
            except FileNotFoundError:
                self._data = dict()


# Tied to the app instance
class Session:
    _lock: Lock
    _config: Config

    _open_path: Optional[Path]
    _session_cookie: int    # to prevent accidental processing of request on the wrong file. _not_ a security feature.

    def __init__(self, config: Config):
        self._lock = Lock()
        self._config = config

        self._open_path = None
        self._session_cookie = 0

    def get_open_document_path(self):
        return self._open_path

    # def open(self, path: Path):
    #     with self._lock:
    #         self._open(path)

    def open_most_recent_or_new_document(self):
        path = self._config.get_most_recent_file_path()

        if path is None:
            # make up a new path
            with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as file:
                path = Path(file.name)
                logger.debug("path=%s", path)
                # now the object will be destroyed, but we have save the file path
                # TODO: delete it on exit

        with self._lock:
            self._open_by_path(path)

    def _open_by_path(self, path: Path):
        self._open_path = path
        self._session_cookie = randrange(1_000_000)
