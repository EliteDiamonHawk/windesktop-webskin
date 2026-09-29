"""Persistence for user-created themes."""

from __future__ import annotations

import json
import os
import tempfile
import uuid
from pathlib import Path
from threading import RLock


class ThemeStorageError(RuntimeError):
    """Raised when a user theme cannot be read or written safely."""


class UserThemeStorage:
    def __init__(self, path: Path | None = None) -> None:
        configured_path = os.getenv("WEBSKIN_THEMES_PATH")
        if path is not None:
            self.path = path
        elif configured_path:
            self.path = Path(configured_path)
        else:
            local_app_data = os.getenv("LOCALAPPDATA")
            base = Path(local_app_data) if local_app_data else Path.home() / "AppData" / "Local"
            self.path = base / "WinDesktopWebskin" / "themes"
        self._lock = RLock()

    def list(self) -> list[dict[str, str]]:
        with self._lock:
            if not self.path.exists():
                return []
            themes: list[dict[str, str]] = []
            for directory in self.path.iterdir():
                metadata_path = directory / "metadata.json"
                if not directory.is_dir() or not metadata_path.is_file():
                    continue
                try:
                    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError) as exc:
                    raise ThemeStorageError(f"Theme metadata is unreadable: {metadata_path}") from exc
                if isinstance(metadata, dict) and isinstance(metadata.get("id"), str) and isinstance(metadata.get("name"), str):
                    themes.append({"id": metadata["id"], "name": metadata["name"]})
            return sorted(themes, key=lambda theme: theme["name"].casefold())

    def create(self, name: str) -> dict[str, str]:
        clean_name = " ".join(name.split())
        if not clean_name:
            raise ThemeStorageError("Theme name cannot be empty")
        with self._lock:
            theme_id = f"theme-{uuid.uuid4().hex}"
            theme_path = self.path / theme_id
            theme_path.mkdir(parents=True, exist_ok=False)
            metadata_path = theme_path / "metadata.json"
            metadata = {"id": theme_id, "name": clean_name, "background": "#ffffff"}
            temporary_path: Path | None = None
            try:
                with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=theme_path, prefix=".metadata.", suffix=".tmp", delete=False) as metadata_file:
                    temporary_path = Path(metadata_file.name)
                    json.dump(metadata, metadata_file, indent=2)
                    metadata_file.write("\n")
                    metadata_file.flush()
                    os.fsync(metadata_file.fileno())
                os.replace(temporary_path, metadata_path)
            except OSError as exc:
                raise ThemeStorageError(f"Could not write theme metadata: {metadata_path}") from exc
            finally:
                if temporary_path is not None:
                    temporary_path.unlink(missing_ok=True)
            return {"id": theme_id, "name": clean_name}


user_theme_storage = UserThemeStorage()
