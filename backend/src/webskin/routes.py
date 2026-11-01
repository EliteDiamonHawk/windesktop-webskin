from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, Body, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.responses import FileResponse, StreamingResponse

from .persistence import SettingsStorageError
from .metrics_streams import DEFAULT_INTERVAL, MAX_FIELDS, MAX_INTERVAL, MIN_INTERVAL
from .paths import get_theme_paths, safe_asset_path
from .settings import SettingNotFoundError, SettingsService
from .system_controls import SYSTEM_CONTROL_COMMANDS, SystemControlError, execute_system_control
from .system_time import get_system_time
from .themes import ThemeNameConflictError, ThemeStorageError, UserThemeStorage, user_theme_storage


def collect_system_metrics(*args: Any, **kwargs: Any) -> dict[str, Any]:
    """Load system telemetry implementation only when telemetry is requested."""
    from .system_metrics import collect_system_metrics as _collect_system_metrics

    return _collect_system_metrics(*args, **kwargs)


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

    @router.get("/widgets/time-intervals")
    def get_time_widget_intervals() -> dict[str, Any]:
        try:
            return settings_service.resolve_time_widget_intervals()
        except SettingsStorageError as exc:
            raise HTTPException(status_code=503, detail="Settings storage is unavailable") from exc

    @router.get("/widgets/system-intervals")
    def get_system_widget_intervals() -> dict[str, Any]:
        try:
            return settings_service.resolve_system_widget_intervals()
        except SettingsStorageError as exc:
            raise HTTPException(status_code=503, detail="Settings storage is unavailable") from exc

    @router.get("/{namespace}/{identifier}")
    def get_scoped(namespace: str, identifier: str) -> dict[str, Any]:
        if namespace not in ("themes", "widgets"):
            raise HTTPException(status_code=404, detail="Settings namespace not found")
        if namespace == "widgets" and not settings_service.is_valid_widget(identifier):
            raise HTTPException(status_code=404, detail="Widget identifier is invalid")
        return read(namespace, identifier=identifier)

    @router.get("/{namespace}/{identifier}/{key}")
    def get_scoped_value(namespace: str, identifier: str, key: str) -> Any:
        if namespace not in ("themes", "widgets"):
            raise HTTPException(status_code=404, detail="Settings namespace not found")
        if namespace == "widgets" and not settings_service.is_valid_widget(identifier):
            raise HTTPException(status_code=404, detail="Widget identifier is invalid")
        return read(namespace, key, identifier)

    @router.put("/{namespace}/{identifier}/{key}")
    def set_scoped_value(namespace: str, identifier: str, key: str, value: Any = Body(...)) -> Any:
        if namespace not in ("themes", "widgets"):
            raise HTTPException(status_code=404, detail="Settings namespace not found")
        if namespace == "widgets" and not settings_service.is_valid_widget(identifier):
            raise HTTPException(status_code=404, detail="Widget identifier is invalid")
        return write(namespace, key, value, identifier)

    @router.delete("/{namespace}/{identifier}/{key}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_scoped_value(namespace: str, identifier: str, key: str) -> None:
        if namespace not in ("themes", "widgets"):
            raise HTTPException(status_code=404, detail="Settings namespace not found")
        if namespace == "widgets" and not settings_service.is_valid_widget(identifier):
            raise HTTPException(status_code=404, detail="Widget identifier is invalid")
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


def create_system_metrics_router(
    collector=collect_system_metrics,
    *,
    subscription_manager=None,
    allowed_origins: list[str] | None = None,
) -> APIRouter:
    router = APIRouter(prefix="/api/system/metrics")
    from .system_metrics import SUPPORTED_METRIC_FIELDS

    allowed_fields = set(SUPPORTED_METRIC_FIELDS)

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

    def parse_stream_fields(raw_fields: str | None) -> set[str] | None:
        if raw_fields is not None and not raw_fields.strip():
            raise HTTPException(status_code=422, detail="Metric fields cannot be empty")
        fields = parse_fields(raw_fields)
        if fields is not None and (not fields or len(fields) > MAX_FIELDS):
            raise HTTPException(status_code=422, detail="Metric field selection is invalid")
        return fields

    def parse_interval(interval: int | None) -> int:
        value = DEFAULT_INTERVAL if interval is None else interval
        if isinstance(value, bool) or not isinstance(value, int) or not MIN_INTERVAL <= value <= MAX_INTERVAL:
            raise HTTPException(
                status_code=422,
                detail=f"Interval must be an integer from {MIN_INTERVAL} through {MAX_INTERVAL}",
            )
        return value

    def resolve_subscription_manager():
        if callable(subscription_manager):
            return subscription_manager()
        return subscription_manager

    @router.get("")
    def get_metrics(fields: str | None = None) -> dict[str, Any]:
        requested_fields = parse_fields(fields)
        return collector() if requested_fields is None else collector(requested_fields=requested_fields)

    @router.get("/events")
    async def metric_events(fields: str | None = None, interval: int | None = None) -> StreamingResponse:
        manager = resolve_subscription_manager()
        if manager is None:
            raise HTTPException(status_code=503, detail="System metric streaming is unavailable")
        requested_fields = parse_stream_fields(fields)
        update_interval = parse_interval(interval)
        try:
            subscription = await manager.subscribe(requested_fields, update_interval)
        except (RuntimeError, ValueError) as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        async def stream():
            try:
                while True:
                    try:
                        message = await asyncio.wait_for(subscription.receive(), timeout=15.0)
                    except asyncio.TimeoutError:
                        yield ": heartbeat\n\n"
                        continue
                    if message is None:
                        return
                    event_name = message.get("type", "message")
                    payload = json.dumps(message, separators=(",", ":"), ensure_ascii=False)
                    yield f"event: {event_name}\ndata: {payload}\n\n"
            finally:
                subscription.close()

        return StreamingResponse(
            stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )

    @router.websocket("/ws")
    async def metric_websocket(websocket: WebSocket) -> None:
        origin = websocket.headers.get("origin")
        if allowed_origins is not None and origin and origin not in allowed_origins:
            await websocket.close(code=1008, reason="Origin is not allowed")
            return
        manager = resolve_subscription_manager()
        if manager is None:
            await websocket.close(code=1013, reason="System metric streaming is unavailable")
            return
        await websocket.accept()
        subscription = None
        sender_task: asyncio.Task[None] | None = None

        async def stop_subscription() -> None:
            nonlocal subscription, sender_task
            if subscription is not None:
                subscription.close()
                subscription = None
            if sender_task is not None:
                sender_task.cancel()
                try:
                    await sender_task
                except asyncio.CancelledError:
                    pass
                sender_task = None

        async def send_updates(active_subscription) -> None:
            while True:
                message = await active_subscription.receive()
                if message is None:
                    return
                await websocket.send_json(message)

        async def send_error(code: str, message: str) -> None:
            await websocket.send_json({"type": "error", "code": code, "message": message})

        def message_fields(message: dict[str, Any]) -> set[str] | None:
            if "fields" not in message:
                return None
            raw_fields = message["fields"]
            if not isinstance(raw_fields, list) or not raw_fields or len(raw_fields) > MAX_FIELDS:
                raise ValueError(f"fields must be a non-empty list of up to {MAX_FIELDS} supported metric fields")
            if any(not isinstance(field, str) for field in raw_fields):
                raise ValueError("fields must contain strings")
            parsed = {field.strip() for field in raw_fields if field.strip()}
            if len(parsed) != len(raw_fields):
                raise ValueError("fields must contain unique, non-empty values")
            invalid = sorted(parsed - allowed_fields)
            if invalid:
                raise ValueError(f"Unsupported system metric field: {invalid[0]}")
            return parsed

        try:
            while True:
                raw_message = await websocket.receive_text()
                if len(raw_message.encode("utf-8")) > 64 * 1024:
                    await websocket.close(code=1009, reason="Message is too large")
                    return
                try:
                    message = json.loads(raw_message)
                except json.JSONDecodeError:
                    await send_error("invalid_message", "Message must contain valid JSON")
                    continue
                if not isinstance(message, dict) or not isinstance(message.get("type"), str):
                    await send_error("invalid_message", "Message must be an object with a type")
                    continue

                operation = message["type"]
                if operation == "subscribe":
                    try:
                        requested_fields = message_fields(message)
                        raw_interval = message.get("interval", DEFAULT_INTERVAL)
                        if isinstance(raw_interval, bool) or not isinstance(raw_interval, int) or not MIN_INTERVAL <= raw_interval <= MAX_INTERVAL:
                            raise ValueError(f"interval must be an integer from {MIN_INTERVAL} through {MAX_INTERVAL}")
                        await stop_subscription()
                        subscription = await manager.subscribe(requested_fields, raw_interval)
                    except (RuntimeError, ValueError) as exc:
                        await send_error("invalid_subscription", str(exc))
                        continue
                    await websocket.send_json({
                        "type": "subscribed",
                        "fields": None if requested_fields is None else sorted(requested_fields),
                        "interval": raw_interval,
                    })
                    sender_task = asyncio.create_task(send_updates(subscription))
                    continue

                if operation == "unsubscribe":
                    if subscription is None:
                        await websocket.send_json({"type": "unsubscribed", "fields": []})
                        continue
                    try:
                        remove_fields = message_fields(message)
                    except ValueError as exc:
                        await send_error("invalid_subscription", str(exc))
                        continue
                    if remove_fields is None:
                        removed = None if subscription.fields is None else sorted(subscription.fields)
                        await stop_subscription()
                        await websocket.send_json({"type": "unsubscribed", "fields": removed})
                        continue
                    current_fields = set(allowed_fields) if subscription.fields is None else set(subscription.fields)
                    current_interval = subscription.interval
                    remaining = current_fields - remove_fields
                    await stop_subscription()
                    await websocket.send_json({"type": "unsubscribed", "fields": sorted(remove_fields)})
                    if remaining:
                        subscription = await manager.subscribe(remaining, current_interval)
                        sender_task = asyncio.create_task(send_updates(subscription))
                    continue

                if operation == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue
                await send_error("unsupported_operation", "Unsupported metric WebSocket operation")
        except WebSocketDisconnect:
            return
        finally:
            await stop_subscription()

    return router


def create_system_time_router(clock=get_system_time) -> APIRouter:
    router = APIRouter(prefix="/api/system/time")

    @router.get("")
    def get_time() -> dict[str, int]:
        return clock()

    return router


def create_system_controls_router(control_runner=execute_system_control) -> APIRouter:
    router = APIRouter(prefix="/api/system/controls")

    @router.post("/{control}", status_code=status.HTTP_204_NO_CONTENT)
    def run_control(control: str) -> None:
        if control not in SYSTEM_CONTROL_COMMANDS:
            raise HTTPException(status_code=404, detail="System control was not found")
        try:
            control_runner(control)
        except (OSError, SystemControlError) as exc:
            raise HTTPException(status_code=503, detail="System control is unavailable") from exc

    return router
