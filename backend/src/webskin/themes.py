"""Persistence for user-created themes."""

from __future__ import annotations

import json
import os
import shutil
import tempfile
from base64 import b64decode
from binascii import Error as Base64Error
from pathlib import Path
import re
from threading import RLock
from typing import Any

from .paths import get_theme_paths


class ThemeStorageError(RuntimeError):
    """Raised when a user theme cannot be read or written safely."""


class ThemeNameConflictError(ThemeStorageError):
    """Raised when a theme name is already in use."""


class UserThemeStorage:
    _THEME_DIRECTORIES = (
        "animations",
        "assets",
        "assets/audio",
        "assets/fonts",
        "assets/icons",
        "assets/images",
        "assets/video",
        "components",
        "config",
        "hooks",
        "widgets",
    )

    _THEME_FILES = {
        "index.html": """<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>Theme</title>
    <link rel=\"stylesheet\" href=\"theme.css\" />
  </head>
  <body></body>
</html>
""",
        "theme.css": """:root {
  color-scheme: light;
  font-family: system-ui, sans-serif;
}

html,
body {
  min-height: 100%;
  margin: 0;
}
""",
        "README.md": """# Theme

Place theme components, widgets, animations, configuration, and assets in the
matching folders in this directory.
""",
    }

    def __init__(self, path: Path | None = None) -> None:
        if path is not None:
            self.path = path
        else:
            # User-created packages share the same installed directory as
            # bundled packages. The runtime serving path is identical for all.
            self.path = get_theme_paths().theme_root
        self._lock = RLock()

    def list(self) -> list[dict[str, Any]]:
        with self._lock:
            if not self.path.exists():
                return []
            themes: list[dict[str, Any]] = []
            for directory in self.path.iterdir():
                metadata_path = directory / "metadata.json"
                if not directory.is_dir() or not metadata_path.is_file():
                    continue
                try:
                    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError) as exc:
                    raise ThemeStorageError(f"Theme metadata is unreadable: {metadata_path}") from exc
                if (
                    isinstance(metadata, dict)
                    and metadata.get("id") == directory.name
                    and isinstance(metadata.get("name"), str)
                ):
                    if metadata.get("source") == "bundled":
                        continue
                    if not (directory / "index.html").is_file():
                        continue
                    metadata_changed = False
                    if "preview-after-loadtime" not in metadata:
                        metadata["preview-after-loadtime"] = 500
                        metadata_changed = True
                    if "allow-new-preview" not in metadata:
                        metadata["allow-new-preview"] = True
                        metadata_changed = True
                    if metadata_changed:
                        temporary_path: Path | None = None
                        try:
                            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=directory, prefix=".metadata.", suffix=".tmp", delete=False) as metadata_file:
                                temporary_path = Path(metadata_file.name)
                                json.dump(metadata, metadata_file, indent=2)
                                metadata_file.write("\n")
                                metadata_file.flush()
                                os.fsync(metadata_file.fileno())
                            os.replace(temporary_path, metadata_path)
                        except OSError as exc:
                            raise ThemeStorageError(f"Could not update theme metadata: {metadata_path}") from exc
                        finally:
                            if temporary_path is not None:
                                temporary_path.unlink(missing_ok=True)
                    themes.append({
                        "id": metadata["id"],
                        "name": metadata["name"],
                        "source": "user",
                        "entry_url": f"/themes/{metadata['id']}/",
                        "preview": f"/api/themes/{metadata['id']}/preview" if (directory / "preview.png").is_file() else None,
                        "preview-after-loadtime": self._preview_after_loadtime(metadata),
                        "allow-new-preview": metadata.get("allow-new-preview") is not False,
                    })
            return sorted(themes, key=lambda theme: theme["name"].casefold())

    def create(self, name: str) -> dict[str, Any]:
        clean_name = self._clean_theme_name(name)
        with self._lock:
            self.path.mkdir(parents=True, exist_ok=True)
            theme_id = self._unique_theme_name(clean_name)
            clean_name = theme_id
            theme_path = self.path / theme_id
            staging_path = Path(tempfile.mkdtemp(prefix=f".{theme_id}.", dir=self.path))
            metadata = {
                "id": theme_id,
                "name": clean_name,
                "background": "#ffffff",
                "preview-after-loadtime": 500,
                "allow-new-preview": True,
            }
            temporary_path: Path | None = None
            try:
                for relative_directory in self._THEME_DIRECTORIES:
                    (staging_path / relative_directory).mkdir(parents=True, exist_ok=True)
                for relative_file, contents in self._THEME_FILES.items():
                    (staging_path / relative_file).write_text(contents, encoding="utf-8")
                for relative_directory in self._THEME_DIRECTORIES:
                    directory = staging_path / relative_directory
                    (directory / ".gitkeep").write_text("", encoding="utf-8")

                metadata_path = staging_path / "metadata.json"
                with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=staging_path, prefix=".metadata.", suffix=".tmp", delete=False) as metadata_file:
                    temporary_path = Path(metadata_file.name)
                    json.dump(metadata, metadata_file, indent=2)
                    metadata_file.write("\n")
                    metadata_file.flush()
                    os.fsync(metadata_file.fileno())
                os.replace(temporary_path, metadata_path)
                os.replace(staging_path, theme_path)
            except OSError as exc:
                raise ThemeStorageError(f"Could not initialize theme: {theme_path}") from exc
            finally:
                if temporary_path is not None:
                    temporary_path.unlink(missing_ok=True)
                if staging_path.exists():
                    shutil.rmtree(staging_path, ignore_errors=True)
            return {
                "id": theme_id,
                "name": clean_name,
                "source": "user",
                "entry_url": f"/themes/{theme_id}/",
                "preview-after-loadtime": 500,
                "allow-new-preview": True,
            }

    def duplicate(self, theme_id: str) -> dict[str, Any]:
        """Create a user-owned copy of a bundled or user theme."""
        with self._lock:
            if Path(theme_id).name != theme_id or not theme_id:
                raise ThemeStorageError("Theme was not found")

            source_path = self.path / theme_id
            metadata = self._read_metadata(source_path)
            if (
                not source_path.is_dir()
                or not isinstance(metadata, dict)
                or not (source_path / "index.html").is_file()
            ):
                raise ThemeStorageError("Theme was not found")

            source_name = metadata.get("name")
            if not isinstance(source_name, str) or not source_name.strip():
                raise ThemeStorageError("Theme metadata is invalid")

            copy_name = self._unique_theme_name(self._clean_theme_name(f"{source_name} Copy"))
            destination_path = self.path / copy_name
            staging_path = Path(tempfile.mkdtemp(prefix=f".{copy_name}.", dir=self.path))
            temporary_path: Path | None = None
            copied_metadata = {
                **metadata,
                "id": copy_name,
                "name": copy_name,
                "source": "user",
            }
            try:
                shutil.copytree(source_path, staging_path, dirs_exist_ok=True)
                metadata_path = staging_path / "metadata.json"
                with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=staging_path, prefix=".metadata.", suffix=".tmp", delete=False) as metadata_file:
                    temporary_path = Path(metadata_file.name)
                    json.dump(copied_metadata, metadata_file, indent=2)
                    metadata_file.write("\n")
                    metadata_file.flush()
                    os.fsync(metadata_file.fileno())
                os.replace(temporary_path, metadata_path)
                os.replace(staging_path, destination_path)
            except OSError as exc:
                raise ThemeStorageError(f"Could not duplicate theme: {theme_id}") from exc
            finally:
                if temporary_path is not None:
                    temporary_path.unlink(missing_ok=True)
                if staging_path.exists():
                    shutil.rmtree(staging_path, ignore_errors=True)

            return {
                "id": copy_name,
                "name": copy_name,
                "source": "user",
                "entry_url": f"/themes/{copy_name}/",
                "preview": f"/api/themes/{copy_name}/preview" if (destination_path / "preview.png").is_file() else None,
                "preview-after-loadtime": self._preview_after_loadtime(copied_metadata),
                "allow-new-preview": copied_metadata.get("allow-new-preview") is not False,
            }

    @staticmethod
    def _clean_theme_name(name: str) -> str:
        clean_name = " ".join(name.split())
        if not clean_name:
            raise ThemeStorageError("Theme name cannot be empty")
        if (
            any(ord(character) < 32 for character in clean_name)
            or any(character in '<>:/\\|?*"' for character in clean_name)
            or clean_name.endswith((".", " "))
            or clean_name in (".", "..")
        ):
            raise ThemeStorageError("Theme name contains invalid path characters")
        reserved_name = clean_name.split(".", 1)[0].casefold()
        if reserved_name in {"con", "prn", "aux", "nul", *(f"com{index}" for index in range(1, 10)), *(f"lpt{index}" for index in range(1, 10))}:
            raise ThemeStorageError("Theme name is reserved by Windows")
        return clean_name

    def _unique_theme_name(self, requested_name: str) -> str:
        existing_names = {
            metadata.get("name").casefold()
            for directory in self.path.iterdir()
            if directory.is_dir()
            for metadata in [self._read_metadata(directory)]
            if isinstance(metadata, dict) and isinstance(metadata.get("name"), str)
        }
        if requested_name.casefold() not in existing_names:
            return requested_name

        match = re.match(r"^(.*?)(?:\s+(\d+))?$", requested_name)
        stem = (match.group(1) if match else requested_name).rstrip()
        suffix = int(match.group(2)) + 1 if match and match.group(2) else 2
        candidate = f"{stem} {suffix}"
        while candidate.casefold() in existing_names:
            suffix += 1
            candidate = f"{stem} {suffix}"
        return candidate

    @staticmethod
    def _read_metadata(directory: Path) -> dict[str, Any] | None:
        metadata_path = directory / "metadata.json"
        if not metadata_path.is_file():
            return None
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        return metadata if isinstance(metadata, dict) else None

    def content_path(self, theme_id: str, relative_path: str = "") -> Path:
        """Resolve a theme asset while keeping the request inside its directory."""
        with self._lock:
            if Path(theme_id).name != theme_id or not theme_id:
                raise ThemeStorageError("Theme content was not found")

            theme_path = (self.path / theme_id).resolve()
            if not theme_path.is_dir() or not (theme_path / "metadata.json").is_file():
                raise ThemeStorageError("Theme content was not found")

            requested_path = Path(relative_path.replace("\\", "/"))
            if requested_path.is_absolute() or ".." in requested_path.parts:
                raise ThemeStorageError("Theme content path is invalid")

            resolved_path = (theme_path / requested_path).resolve()
            try:
                resolved_path.relative_to(theme_path)
            except ValueError as exc:
                raise ThemeStorageError("Theme content path is invalid") from exc

            if resolved_path.is_dir():
                resolved_path = resolved_path / "index.html"
            if not resolved_path.is_file():
                raise ThemeStorageError("Theme content was not found")
            return resolved_path

    def delete(self, theme_id: str) -> None:
        with self._lock:
            if Path(theme_id).name != theme_id or not theme_id:
                raise ThemeStorageError("Theme was not found")
            theme_path = self.path / theme_id
            if not theme_path.is_dir() or not (theme_path / "metadata.json").is_file():
                raise ThemeStorageError("Theme was not found")
            try:
                shutil.rmtree(theme_path)
            except OSError as exc:
                raise ThemeStorageError(f"Could not delete theme: {theme_id}") from exc

    def rename(self, theme_id: str, name: str) -> dict[str, Any]:
        clean_name = self._clean_theme_name(name)
        with self._lock:
            if Path(theme_id).name != theme_id or not theme_id:
                raise ThemeStorageError("Theme was not found")
            theme_path = self.path / theme_id
            metadata = self._read_metadata(theme_path)
            if not theme_path.is_dir() or not isinstance(metadata, dict):
                raise ThemeStorageError("Theme was not found")

            existing_names = {
                other_metadata.get("name").casefold()
                for directory in self.path.iterdir()
                if directory.is_dir() and directory.name != theme_id
                for other_metadata in [self._read_metadata(directory)]
                if isinstance(other_metadata, dict) and isinstance(other_metadata.get("name"), str)
            }
            if clean_name.casefold() in existing_names:
                raise ThemeNameConflictError("Theme name is already in use")

            new_path = self.path / clean_name
            if new_path != theme_path and new_path.exists():
                raise ThemeNameConflictError("Theme name is already in use")

            updated_metadata = {**metadata, "id": clean_name, "name": clean_name}
            renamed = False
            try:
                if new_path != theme_path:
                    os.replace(theme_path, new_path)
                    renamed = True
                metadata_path = new_path / "metadata.json"
                temporary_path: Path | None = None
                try:
                    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=new_path, prefix=".metadata.", suffix=".tmp", delete=False) as metadata_file:
                        temporary_path = Path(metadata_file.name)
                        json.dump(updated_metadata, metadata_file, indent=2)
                        metadata_file.write("\n")
                        metadata_file.flush()
                        os.fsync(metadata_file.fileno())
                    os.replace(temporary_path, metadata_path)
                finally:
                    if temporary_path is not None:
                        temporary_path.unlink(missing_ok=True)
            except OSError as exc:
                if renamed:
                    try:
                        os.replace(new_path, theme_path)
                    except OSError:
                        pass
                raise ThemeStorageError(f"Could not rename theme: {theme_id}") from exc

            return {
                "id": clean_name,
                "name": clean_name,
                "source": "user",
                "entry_url": f"/themes/{clean_name}/",
                "preview": f"/api/themes/{clean_name}/preview" if (new_path / "preview.png").is_file() else None,
                "preview-after-loadtime": self._preview_after_loadtime(updated_metadata),
                "allow-new-preview": updated_metadata.get("allow-new-preview") is not False,
            }

    @staticmethod
    def _preview_after_loadtime(metadata: dict[str, Any]) -> int:
        value = metadata.get("preview-after-loadtime", 0)
        return value if isinstance(value, int) and value >= 0 else 0

    def save_preview(self, theme_id: str, data_url: str) -> None:
        if not data_url.startswith("data:image/png;base64,"):
            raise ThemeStorageError("Preview must be a PNG data URL")
        try:
            preview = b64decode(data_url.removeprefix("data:image/png;base64,"), validate=True)
        except (ValueError, Base64Error) as exc:
            raise ThemeStorageError("Preview data is not valid base64") from exc
        if not preview.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ThemeStorageError("Preview data is not a PNG")

        with self._lock:
            if Path(theme_id).name != theme_id:
                raise ThemeStorageError("Theme was not found")
            theme_path = self.path / theme_id
            if not theme_path.is_dir() or not (theme_path / "metadata.json").is_file():
                raise ThemeStorageError("Theme was not found")
            temporary_path: Path | None = None
            try:
                with tempfile.NamedTemporaryFile(mode="wb", dir=theme_path, prefix=".preview.", suffix=".tmp", delete=False) as preview_file:
                    temporary_path = Path(preview_file.name)
                    preview_file.write(preview)
                    preview_file.flush()
                    os.fsync(preview_file.fileno())
                os.replace(temporary_path, theme_path / "preview.png")
                # A generated preview supersedes the package's old authored
                # preview asset. Keep the generated PNG as the sole preview.
                (theme_path / "preview.svg").unlink(missing_ok=True)
            except OSError as exc:
                raise ThemeStorageError(f"Could not write theme preview: {theme_path / 'preview.png'}") from exc
            finally:
                if temporary_path is not None:
                    temporary_path.unlink(missing_ok=True)

    def preview_path(self, theme_id: str) -> Path:
        with self._lock:
            if Path(theme_id).name != theme_id:
                raise ThemeStorageError("Theme preview was not found")
            theme_path = self.path / theme_id
            preview_path = theme_path / "preview.png"
            if not theme_path.is_dir() or not preview_path.is_file():
                raise ThemeStorageError("Theme preview was not found")
            return preview_path


user_theme_storage = UserThemeStorage()
