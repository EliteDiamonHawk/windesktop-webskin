"""Centralized locations for installed WebSkin theme packages."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class ThemePaths:
    """The one root and the two independently served directories beneath it."""

    root: Path

    @property
    def common_root(self) -> Path:
        return self.root / "common"

    @property
    def theme_root(self) -> Path:
        return self.root / "themes"


def _local_app_data() -> Path:
    configured = os.getenv("LOCALAPPDATA")
    return Path(configured) if configured else Path.home() / "AppData" / "Local"


def resolve_themes_root() -> Path:
    """Resolve the runtime theme root without spreading environment logic around."""
    explicit_root = os.getenv("WEBSKIN_THEMES_ROOT")
    if explicit_root:
        return Path(explicit_root).expanduser().resolve()

    # The frozen host is a production signal.  WEBSKIN_ENV makes the choice
    # explicit for unpackaged production deployments and test environments.
    environment = os.getenv("WEBSKIN_ENV", "development").casefold()
    production_flag = os.getenv("WEBSKIN_PRODUCTION", "").casefold()
    production = environment in {"production", "prod", "release"} or production_flag in {"1", "true", "yes"}
    if getattr(sys, "frozen", False) or production:
        return (_local_app_data() / "WinDesktop WebSkin" / "themes").resolve()

    return (REPOSITORY_ROOT / "themes").resolve()


def get_theme_paths() -> ThemePaths:
    return ThemePaths(resolve_themes_root())


# Convenient import-time values for callers that need to display or inspect
# the configured locations. Runtime handlers call get_theme_paths() so tests
# and embedded hosts can change the environment before handling a request.
THEMES_ROOT = resolve_themes_root()
COMMON_ROOT = THEMES_ROOT / "common"
THEME_ROOT = THEMES_ROOT / "themes"


def safe_asset_path(root: Path, relative_path: str) -> Path:
    """Resolve a browser asset while keeping it inside its package root."""
    requested = Path(relative_path.replace("\\", "/"))
    if requested.is_absolute() or ".." in requested.parts:
        raise ValueError("Asset path is invalid")

    resolved_root = root.resolve()
    resolved_path = (resolved_root / requested).resolve()
    try:
        resolved_path.relative_to(resolved_root)
    except ValueError as exc:
        raise ValueError("Asset path is invalid") from exc
    if not resolved_path.is_file():
        raise FileNotFoundError(resolved_path)
    return resolved_path
