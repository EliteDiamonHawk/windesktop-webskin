from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException, status
from fastapi.responses import FileResponse

from .persistence import SettingsStorageError
from .paths import get_theme_paths, safe_asset_path
from .settings import SettingNotFoundError, SettingsService
from .system_metrics import collect_system_metrics
from .themes import ThemeNameConflictError, ThemeStorageError, UserThemeStorage, user_theme_storage


def create_settings_router(service: SettingsService | None = None) -> APIRouter:
    settings_service = service or SettingsService()
    router = APIRouter(prefix="/api/settings")

    def read(namespace: str, key: str | None = None, identifier: str | None = None) -> Any:
        try:
            return settings_service.get(namespace, key, identifier)
        except SettingNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Setting not found") from exc
        except SettingsStorageError as exc:
            raise HTTPException(status_code=503, detail="Settings storage is unavailable") from exc

    def write(namespace: str, key: str, value: Any, identifier: str | None = None) -> Any:
        try:
            return settings_service.set(namespace, key, value, identifier)
        except SettingsStorageError as exc:
            raise HTTPException(status_code=503, detail="Settings storage is unavailable") from exc

    def remove(namespace: str, key: str, identifier: str | None = None) -> None:
        try:
            settings_service.delete(namespace, key, identifier)
        except SettingNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Setting not found") from exc
        except SettingsStorageError as exc:
            raise HTTPException(status_code=503, detail="Settings storage is unavailable") from exc

    @router.get("/app")
    def get_app() -> dict[str, Any]:
        return read("app")

    @router.get("/app/{key}")
    def get_app_value(key: str) -> Any:
        return read("app", key)

    @router.put("/app/{key}")
    def set_app_value(key: str, value: Any = Body(...)) -> Any:
        return write("app", key, value)

    @router.delete("/app/{key}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_app_value(key: str) -> None:
        remove("app", key)

    @router.get("/{namespace}/{identifier}")
    def get_scoped(namespace: str, identifier: str) -> dict[str, Any]:
        if namespace not in ("themes", "widgets"):
            raise HTTPException(status_code=404, detail="Settings namespace not found")
        return read(namespace, identifier=identifier)

    @router.get("/{namespace}/{identifier}/{key}")
    def get_scoped_value(namespace: str, identifier: str, key: str) -> Any:
        if namespace not in ("themes", "widgets"):
            raise HTTPException(status_code=404, detail="Settings namespace not found")
        return read(namespace, key, identifier)

    @router.put("/{namespace}/{identifier}/{key}")
    def set_scoped_value(namespace: str, identifier: str, key: str, value: Any = Body(...)) -> Any:
        if namespace not in ("themes", "widgets"):
            raise HTTPException(status_code=404, detail="Settings namespace not found")
        return write(namespace, key, value, identifier)

    @router.delete("/{namespace}/{identifier}/{key}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_scoped_value(namespace: str, identifier: str, key: str) -> None:
        if namespace not in ("themes", "widgets"):
            raise HTTPException(status_code=404, detail="Settings namespace not found")
        remove(namespace, key, identifier)

    return router


def create_themes_router(storage: UserThemeStorage | None = None) -> APIRouter:
    themes_storage = storage or user_theme_storage
    router = APIRouter(prefix="/api/themes")

    @router.get("")
    def list_themes() -> list[dict[str, Any]]:
        try:
            return themes_storage.list()
        except ThemeStorageError as exc:
            raise HTTPException(status_code=503, detail="Theme storage is unavailable") from exc

    @router.post("", status_code=status.HTTP_201_CREATED)
    def create_theme(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
        name = payload.get("name")
        if not isinstance(name, str):
            raise HTTPException(status_code=422, detail="Theme name must be a string")
        try:
            return themes_storage.create(name)
        except ThemeStorageError as exc:
            raise HTTPException(status_code=503, detail="Theme storage is unavailable") from exc

    @router.post("/{theme_id}/duplicate", status_code=status.HTTP_201_CREATED)
    def duplicate_theme(theme_id: str) -> dict[str, Any]:
        try:
            return themes_storage.duplicate(theme_id)
        except ThemeStorageError as exc:
            raise HTTPException(status_code=404, detail="Theme was not found") from exc

    @router.delete("/{theme_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_theme(theme_id: str) -> None:
        try:
            themes_storage.delete(theme_id)
        except ThemeStorageError as exc:
            raise HTTPException(status_code=404, detail="Theme was not found") from exc

    @router.patch("/{theme_id}")
    def rename_theme(theme_id: str, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
        name = payload.get("name")
        if not isinstance(name, str):
            raise HTTPException(status_code=422, detail="Theme name must be a string")
        try:
            return themes_storage.rename(theme_id, name)
        except ThemeNameConflictError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except ThemeStorageError as exc:
            raise HTTPException(status_code=404, detail="Theme was not found") from exc

    @router.put("/{theme_id}/preview", status_code=status.HTTP_204_NO_CONTENT)
    def save_theme_preview(theme_id: str, payload: dict[str, Any] = Body(...)) -> None:
        preview = payload.get("png")
        if not isinstance(preview, str):
            raise HTTPException(status_code=422, detail="Preview must be a PNG data URL")
        try:
            themes_storage.save_preview(theme_id, preview)
        except ThemeStorageError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @router.get("/{theme_id}/preview")
    def get_theme_preview(theme_id: str) -> FileResponse:
        try:
            preview_path = themes_storage.preview_path(theme_id)
        except ThemeStorageError as exc:
            raise HTTPException(status_code=404, detail="Theme preview was not found") from exc
        return FileResponse(preview_path, media_type="image/png")

    return router


def create_theme_assets_router(storage: UserThemeStorage | None = None) -> APIRouter:
    """Serve the stable browser URLs used by every installed theme package."""
    themes_storage = storage or user_theme_storage
    router = APIRouter()

    @router.get("/common/{relative_path:path}")
    def get_common_asset(relative_path: str) -> FileResponse:
        try:
            common_path = safe_asset_path(get_theme_paths().common_root, relative_path)
        except (ValueError, FileNotFoundError) as exc:
            raise HTTPException(status_code=404, detail="Common asset was not found") from exc
        return FileResponse(common_path)

    @router.get("/themes/{theme_id}")
    @router.get("/themes/{theme_id}/")
    def get_theme_asset_root(theme_id: str) -> FileResponse:
        return get_theme_asset(theme_id, "")

    @router.get("/themes/{theme_id}/{relative_path:path}")
    def get_theme_asset(theme_id: str, relative_path: str) -> FileResponse:
        try:
            content_path = themes_storage.content_path(theme_id, relative_path)
        except ThemeStorageError as exc:
            raise HTTPException(status_code=404, detail="Theme asset was not found") from exc
        return FileResponse(content_path)

    return router


def create_system_router(collector=collect_system_metrics) -> APIRouter:
    router = APIRouter(prefix="/api/system")

    allowed_fields = {
        "cpu.utilization",
        "cpu.utilization.overall",
        "cpu.utilization.per_core",
        "cpu.cores",
        "cpu.cores.physical",
        "cpu.cores.logical",
        "cpu.frequencies",
        "cpu.frequencies.current_mhz",
        "cpu.frequencies.minimum_mhz",
        "cpu.frequencies.maximum_mhz",
        "cpu.frequencies.per_core",
        "cpu.frequencies.per_core.current_mhz",
        "cpu.frequencies.per_core.minimum_mhz",
        "cpu.frequencies.per_core.maximum_mhz",
        "cpu.telemetry",
        "cpu.telemetry.interrupts",
        "cpu.telemetry.system_calls",
        "cpu.telemetry.context_switches",
        "cpu.load_average",
        "cpu.load_average.one_minute",
        "cpu.load_average.five_minutes",
        "cpu.load_average.fifteen_minutes",
        "memory.virtual",
        "memory.virtual.total_bytes",
        "memory.virtual.available_bytes",
        "memory.virtual.used_bytes",
        "memory.virtual.free_bytes",
        "memory.virtual.percent",
        "memory.swap",
        "memory.swap.total_bytes",
        "memory.swap.used_bytes",
        "memory.swap.free_bytes",
        "memory.swap.percent",
        "disks.partitions",
        "disks.partitions.mount_point",
        "disks.partitions.filesystem",
        "disks.partitions.mount_options",
        "disks.usage",
        "disks.usage.mount_point",
        "disks.usage.total_bytes",
        "disks.usage.used_bytes",
        "disks.usage.free_bytes",
        "disks.usage.percent",
        "disks.io",
        "disks.io.read_count",
        "disks.io.write_count",
        "disks.io.read_bytes",
        "disks.io.write_bytes",
        "disks.io.read_time_ms",
        "disks.io.write_time_ms",
        "disks.io.busy_time_ms",
        "network",
        "network.bytes_sent",
        "network.bytes_received",
        "network.packets_dropped",
        "network.transmission_errors",
        "sensors.temperatures",
        "sensors.fans",
        "sensors.battery",
        "sensors.battery.percent",
        "sensors.battery.seconds_left",
        "sensors.battery.power_plugged",
        "sensors.readings",
    }

    def parse_fields(raw_fields: str | None) -> set[str] | None:
        if raw_fields is None:
            return None
        fields = {field.strip() for field in raw_fields.split(",") if field.strip()}
        invalid = [
            field for field in fields
            if field not in allowed_fields
        ]
        if invalid:
            raise HTTPException(status_code=422, detail=f"Unsupported system metric field: {invalid[0]}")
        return fields

    @router.get("/metrics")
    def get_metrics(fields: str | None = None) -> dict[str, Any]:
        requested_fields = parse_fields(fields)
        return collector() if requested_fields is None else collector(requested_fields=requested_fields)

    return router
