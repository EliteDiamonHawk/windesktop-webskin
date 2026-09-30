"""Storage primitives for persisted application settings.

The service layer uses this interface instead of knowing how settings are stored,
so the JSON implementation can later be replaced with another backend.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path
from threading import RLock
from typing import Any, Protocol

from .paths import REPOSITORY_ROOT


class SettingsStorageError(RuntimeError):
    """Raised when persisted settings cannot be safely read or written."""


class SettingsStorage(Protocol):
    def get_namespace(self, namespace: str, identifier: str | None = None) -> dict[str, Any]: ...
    def get_value(self, namespace: str, key: str, identifier: str | None = None) -> Any: ...
    def set_value(self, namespace: str, key: str, value: Any, identifier: str | None = None) -> None: ...
    def delete_value(self, namespace: str, key: str, identifier: str | None = None) -> bool: ...


class JsonSettingsStorage:
    """Atomic, process-safe JSON storage for the three settings namespaces."""

    _version = 1
    _namespaces = ("app", "themes", "widgets")

    def __init__(self, path: Path | None = None) -> None:
        configured_path = os.getenv("WEBSKIN_SETTINGS_PATH")
        if path is not None:
            self.path = path
        elif configured_path:
            self.path = Path(configured_path)
        else:
            environment = os.getenv("WEBSKIN_ENV", "development").casefold()
            production_flag = os.getenv("WEBSKIN_PRODUCTION", "").casefold()
            production = (
                getattr(sys, "frozen", False)
                or environment in {"production", "prod", "release"}
                or production_flag in {"1", "true", "yes"}
            )
            if production:
                local_app_data = os.getenv("LOCALAPPDATA")
                base = Path(local_app_data) if local_app_data else Path.home() / "AppData" / "Local"
                self.path = base / "WinDesktopWebskin" / "settings.json"
            else:
                self.path = REPOSITORY_ROOT / "localdata" / "settings.json"
        self._lock = RLock()

    def get_namespace(self, namespace: str, identifier: str | None = None) -> dict[str, Any]:
        with self._lock:
            data = self._load()
            result = data[namespace] if identifier is None else data[namespace].get(identifier, {})
            return dict(result)

    def get_value(self, namespace: str, key: str, identifier: str | None = None) -> Any:
        with self._lock:
            data = self._load()
            container = data[namespace] if identifier is None else data[namespace].get(identifier, {})
            return container[key] if key in container else _MISSING

    def set_value(self, namespace: str, key: str, value: Any, identifier: str | None = None) -> None:
        with self._lock:
            data = self._load()
            container = data[namespace] if identifier is None else data[namespace].setdefault(identifier, {})
            container[key] = value
            self._write(data)

    def delete_value(self, namespace: str, key: str, identifier: str | None = None) -> bool:
        with self._lock:
            data = self._load()
            container = data[namespace] if identifier is None else data[namespace].get(identifier, {})
            if key not in container:
                return False
            del container[key]
            if identifier is not None and not container:
                data[namespace].pop(identifier, None)
            self._write(data)
            return True

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return self._empty_document()
        try:
            with self.path.open("r", encoding="utf-8") as settings_file:
                data = json.load(settings_file)
        except (OSError, json.JSONDecodeError) as exc:
            raise SettingsStorageError(f"Settings file is unreadable: {self.path}") from exc
        if not isinstance(data, dict) or data.get("version") != self._version:
            raise SettingsStorageError("Settings file has an unsupported format or version")
        for namespace in self._namespaces:
            if not isinstance(data.get(namespace), dict):
                raise SettingsStorageError(f"Settings namespace is invalid: {namespace}")
            if namespace != "app" and any(
                not isinstance(values, dict) for values in data[namespace].values()
            ):
                raise SettingsStorageError(f"Settings namespace contains invalid entries: {namespace}")
        return data

    def _write(self, data: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=self.path.parent, prefix=f".{self.path.name}.",
                suffix=".tmp", delete=False
            ) as temporary_file:
                temporary_path = Path(temporary_file.name)
                json.dump(data, temporary_file, indent=2, ensure_ascii=False)
                temporary_file.write("\n")
                temporary_file.flush()
                os.fsync(temporary_file.fileno())
            os.replace(temporary_path, self.path)
        except OSError as exc:
            raise SettingsStorageError(f"Could not write settings file: {self.path}") from exc
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)

    def _empty_document(self) -> dict[str, Any]:
        return {"version": self._version, "app": {}, "themes": {}, "widgets": {}}


class _Missing:
    pass


_MISSING = _Missing()
