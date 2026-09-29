from __future__ import annotations

from typing import Any

from .persistence import JsonSettingsStorage, SettingsStorage, _MISSING


class SettingNotFoundError(KeyError):
    pass


class SettingsService:
    def __init__(self, storage: SettingsStorage | None = None) -> None:
        self.storage = storage or JsonSettingsStorage()

    def get(self, namespace: str, key: str | None = None, identifier: str | None = None) -> Any:
        if key is None:
            return self.storage.get_namespace(namespace, identifier)
        value = self.storage.get_value(namespace, key, identifier)
        if value is _MISSING:
            raise SettingNotFoundError(key)
        return value

    def set(self, namespace: str, key: str, value: Any, identifier: str | None = None) -> Any:
        self.storage.set_value(namespace, key, value, identifier)
        return value

    def delete(self, namespace: str, key: str, identifier: str | None = None) -> None:
        if not self.storage.delete_value(namespace, key, identifier):
            raise SettingNotFoundError(key)
