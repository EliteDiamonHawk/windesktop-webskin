from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException, status

from .persistence import SettingsStorageError
from .settings import SettingNotFoundError, SettingsService


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
