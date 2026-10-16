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
from urllib.parse import quote

from .paths import REPOSITORY_ROOT


class SettingsStorageError(RuntimeError):
    """Raised when persisted settings cannot be safely read or written."""


class SettingsStorage(Protocol):
    def get_namespace(self, namespace: str, identifier: str | None = None) -> dict[str, Any]: ...
    def get_value(self, namespace: str, key: str, identifier: str | None = None) -> Any: ...
    def set_value(self, namespace: str, key: str, value: Any, identifier: str | None = None) -> None: ...
    def delete_value(self, namespace: str, key: str, identifier: str | None = None) -> bool: ...


class JsonSettingsStorage:
    """Atomic, process-safe JSON storage split by settings namespace."""

    _version = 1
    _namespaces = ("app", "themes", "widgets")

    def __init__(self, path: Path | None = None) -> None:
        configured_path = os.getenv("WEBSKIN_SETTINGS_PATH")
        if path is not None:
            self.path = Path(path)
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
                self.path = base / "WinDesktopWebskin" / "settings"
            else:
                self.path = REPOSITORY_ROOT / "localdata" / "settings"
        self.widgets_path = self.path / "widgets"
        self._lock = RLock()
        self._initialize_storage()

    def get_namespace(self, namespace: str, identifier: str | None = None) -> dict[str, Any]:
        with self._lock:
            document = self._load_namespace(namespace)
            values = document[namespace]
            if namespace != "widgets":
                result = values if identifier is None else values.get(identifier, {})
                return dict(result)

            if identifier is not None:
                return dict(self._load_widget_settings(identifier, values))
            return {
                widget_id: self._load_widget_settings(widget_id, values)
                for widget_id in values
            }

    def get_value(self, namespace: str, key: str, identifier: str | None = None) -> Any:
        with self._lock:
            document = self._load_namespace(namespace)
            if namespace == "widgets" and identifier is not None:
                container = self._load_widget_settings(identifier, document[namespace])
            else:
                values = document[namespace]
                container = values if identifier is None else values.get(identifier, {})
            return container[key] if key in container else _MISSING

    def set_value(self, namespace: str, key: str, value: Any, identifier: str | None = None) -> None:
        with self._lock:
            if namespace == "widgets" and identifier is not None:
                self._set_widget_value(identifier, key, value)
                return

            document = self._load_namespace(namespace)
            values = document[namespace]
            container = values if identifier is None else values.setdefault(identifier, {})
            container[key] = value
            self._write_namespace(namespace, document)

    def delete_value(self, namespace: str, key: str, identifier: str | None = None) -> bool:
        with self._lock:
            if namespace == "widgets" and identifier is not None:
                return self._delete_widget_value(identifier, key)

            document = self._load_namespace(namespace)
            values = document[namespace]
            container = values if identifier is None else values.get(identifier, {})
            if key not in container:
                return False
            del container[key]
            if identifier is not None and not container:
                values.pop(identifier, None)
            self._write_namespace(namespace, document)
            return True

    def _initialize_storage(self) -> None:
        try:
            self.path.mkdir(parents=True, exist_ok=True)
            self.widgets_path.mkdir(parents=True, exist_ok=True)
            defaults = {
                "app": {},
                "themes": {},
                "widgets": {},
            }
            for namespace, values in defaults.items():
                namespace_path = self._namespace_path(namespace)
                if not namespace_path.exists():
                    self._write_document(namespace_path, self._namespace_document(namespace, values))
        except OSError as exc:
            raise SettingsStorageError(f"Could not initialize settings directory: {self.path}") from exc

    def _load_namespace(self, namespace: str) -> dict[str, Any]:
        namespace_path = self._namespace_path(namespace)
        try:
            with namespace_path.open("r", encoding="utf-8") as settings_file:
                data = json.load(settings_file)
        except (OSError, json.JSONDecodeError) as exc:
            raise SettingsStorageError(f"Settings file is unreadable: {namespace_path}") from exc

        if not isinstance(data, dict) or data.get("version") != self._version:
            raise SettingsStorageError(f"Settings file has an unsupported format or version: {namespace_path}")
        values = data.get(namespace)
        if not isinstance(values, dict):
            raise SettingsStorageError(f"Settings namespace is invalid: {namespace}")
        if namespace == "themes" and any(not isinstance(value, dict) for value in values.values()):
            raise SettingsStorageError("Settings namespace contains invalid entries: themes")
        if namespace == "widgets":
            self._validate_widget_index(values)
        return data

    def _set_widget_value(self, identifier: str, key: str, value: Any) -> None:
        self._validate_widget_identifier(identifier)
        document = self._load_namespace("widgets")
        index = document["widgets"]
        entry = index.get(identifier)

        if entry is None:
            settings = {key: value}
            widget_path = self._generated_widget_path(identifier)
            self._write_widget_file(widget_path, identifier, settings)
            index[identifier] = {"file": self._relative_widget_path(widget_path)}
            self._write_namespace("widgets", document)
            return

        settings = self._load_widget_settings(identifier, index)
        settings[key] = value
        widget_path = self._indexed_widget_path(identifier, entry)
        self._write_widget_file(widget_path, identifier, settings)

    def _delete_widget_value(self, identifier: str, key: str) -> bool:
        self._validate_widget_identifier(identifier)
        document = self._load_namespace("widgets")
        index = document["widgets"]
        if identifier not in index:
            return False

        settings = self._load_widget_settings(identifier, index)
        if key not in settings:
            return False
        del settings[key]
        widget_path = self._indexed_widget_path(identifier, index[identifier])
        self._write_widget_file(widget_path, identifier, settings)
        return True

    def _load_widget_settings(self, identifier: str, index: dict[str, Any]) -> dict[str, Any]:
        self._validate_widget_identifier(identifier)
        entry = index.get(identifier)
        if entry is None:
            return {}
        widget_path = self._indexed_widget_path(identifier, entry)
        try:
            with widget_path.open("r", encoding="utf-8") as widget_file:
                data = json.load(widget_file)
        except (OSError, json.JSONDecodeError) as exc:
            raise SettingsStorageError(f"Widget settings file is unreadable: {widget_path}") from exc

        if (
            not isinstance(data, dict)
            or data.get("version") != self._version
            or data.get("id") != identifier
            or not isinstance(data.get("settings"), dict)
        ):
            raise SettingsStorageError(f"Widget settings file has an invalid format: {widget_path}")
        return dict(data["settings"])

    def _validate_widget_index(self, index: dict[str, Any]) -> None:
        for identifier, entry in index.items():
            self._validate_widget_identifier(identifier)
            if not isinstance(entry, dict) or not isinstance(entry.get("file"), str):
                raise SettingsStorageError(f"Widget index entry is invalid: {identifier}")
            self._indexed_widget_path(identifier, entry)

    def _indexed_widget_path(self, identifier: str, entry: dict[str, Any]) -> Path:
        self._validate_widget_identifier(identifier)
        relative_path = Path(entry["file"])
        if (
            relative_path.is_absolute()
            or len(relative_path.parts) != 2
            or relative_path.parts[0] != "widgets"
            or relative_path.suffix != ".json"
            or relative_path.name in {".", ".."}
        ):
            raise SettingsStorageError(f"Widget settings path is invalid: {identifier}")
        candidate = (self.path / relative_path).resolve()
        widgets_root = self.widgets_path.resolve()
        if not candidate.is_relative_to(widgets_root):
            raise SettingsStorageError(f"Widget settings path escapes widgets directory: {identifier}")
        if not candidate.is_file():
            raise SettingsStorageError(f"Widget settings file is missing: {candidate}")
        return candidate

    def _generated_widget_path(self, identifier: str) -> Path:
        self._validate_widget_identifier(identifier)
        return self.widgets_path / f"{quote(identifier, safe='')}.json"

    def _relative_widget_path(self, widget_path: Path) -> str:
        return widget_path.relative_to(self.path).as_posix()

    @staticmethod
    def _validate_widget_identifier(identifier: str) -> None:
        if (
            not isinstance(identifier, str)
            or not identifier
            or identifier in {".", ".."}
            or "/" in identifier
            or "\\" in identifier
            or "\x00" in identifier
        ):
            raise SettingsStorageError("Widget identifier is invalid")

    def _namespace_path(self, namespace: str) -> Path:
        if namespace not in self._namespaces:
            raise SettingsStorageError(f"Settings namespace is invalid: {namespace}")
        return self.path / f"{namespace}.json"

    def _namespace_document(self, namespace: str, values: dict[str, Any]) -> dict[str, Any]:
        return {"version": self._version, namespace: values}

    def _write_namespace(self, namespace: str, data: dict[str, Any]) -> None:
        self._write_document(self._namespace_path(namespace), data)

    def _write_widget_file(self, path: Path, identifier: str, settings: dict[str, Any]) -> None:
        self._write_document(path, {"version": self._version, "id": identifier, "settings": settings})

    def _write_document(self, path: Path, data: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=path.parent,
                prefix=f".{path.name}.",
                suffix=".tmp",
                delete=False,
            ) as temporary_file:
                temporary_path = Path(temporary_file.name)
                json.dump(data, temporary_file, indent=2, ensure_ascii=False)
                temporary_file.write("\n")
                temporary_file.flush()
                os.fsync(temporary_file.fileno())
            os.replace(temporary_path, path)
        except OSError as exc:
            raise SettingsStorageError(f"Could not write settings file: {path}") from exc
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)


class _Missing:
    pass


_MISSING = _Missing()
