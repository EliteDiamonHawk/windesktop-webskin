from __future__ import annotations

from typing import Any

from .persistence import JsonSettingsStorage, SettingsStorage, _MISSING


class SettingNotFoundError(KeyError):
    pass


COMMON_WIDGET_IDS = frozenset({
    "last-boot-plain",
    "battery-plain",
    "cpu-utilization-plain",
    "cpu-utilization-list-plain",
    "cpu-core-counts-plain",
    "cpu-frequency-plain",
    "cpu-telemetry-plain",
    "cpu-load-average-plain",
    "memory-plain",
    "swap-memory-plain",
    "disk-io-plain",
    "network-telemetry-plain",
    "disk-partitions-plain",
    "gpu-thermal-fan-plain",
    "network-telemetry-transfer-plain",
    "digital-plain",
    "digital-prestyled",
    "analog-plain",
    "analog-prestyled",
    "analog-prestyled2",
    "digital-analog-prestyled",
    "digital-day",
    "rainmeter-mond-clock-remake",
    "day-plain",
    "day-prestyled",
    "day-prestyled2",
    "week-plain",
    "week-prestyled",
    "month-plain",
    "month-prestyled",
})

TIME_WIDGET_INTERVALS = {
    **{
        widget_id: ("clock", "time_clock_update_interval_seconds", 5)
        for widget_id in (
            "digital-plain",
            "digital-prestyled",
            "analog-plain",
            "analog-prestyled",
            "analog-prestyled2",
            "digital-analog-prestyled",
            "digital-day",
            "rainmeter-mond-clock-remake",
        )
    },
    **{
        widget_id: ("calendar", "time_calendar_update_interval_seconds", 60)
        for widget_id in (
            "day-plain",
            "day-prestyled",
            "day-prestyled2",
            "week-plain",
            "week-prestyled",
            "month-plain",
            "month-prestyled",
        )
    },
}

SYSTEM_WIDGET_INTERVALS = {
    **{
        widget_id: ("fast", "system_fast_update_interval_seconds", 5)
        for widget_id in (
            "cpu-utilization-plain",
            "cpu-utilization-list-plain",
            "disk-io-plain",
            "network-telemetry-plain",
            "network-telemetry-transfer-plain",
            "gpu-thermal-fan-plain",
        )
    },
    **{
        widget_id: ("standard", "system_standard_update_interval_seconds", 30)
        for widget_id in (
            "memory-plain",
            "swap-memory-plain",
            "battery-plain",
            "cpu-frequency-plain",
            "cpu-telemetry-plain",
            "cpu-load-average-plain",
        )
    },
    **{
        widget_id: ("slow", "system_slow_update_interval_seconds", 60)
        for widget_id in (
            "cpu-core-counts-plain",
            "disk-partitions-plain",
        )
    },
}


def _valid_interval(value: Any) -> bool:
    return type(value) is int and value > 0


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

    @staticmethod
    def is_common_widget(identifier: str) -> bool:
        return identifier in COMMON_WIDGET_IDS

    @staticmethod
    def is_valid_widget(identifier: str) -> bool:
        return bool(
            isinstance(identifier, str)
            and identifier
            and identifier not in {".", ".."}
            and "/" not in identifier
            and "\\" not in identifier
            and "\x00" not in identifier
        )

    def resolve_time_widget_intervals(self) -> dict[str, Any]:
        family_defaults: dict[str, int] = {}
        resolved_widgets: dict[str, int] = {}
        for widget_id, (family, app_key, fallback) in TIME_WIDGET_INTERVALS.items():
            if family not in family_defaults:
                app_value = self.storage.get_value("app", app_key)
                family_defaults[family] = app_value if _valid_interval(app_value) else fallback

            widget_value = self.storage.get_value("widgets", "updateInterval", widget_id)
            resolved_widgets[widget_id] = (
                widget_value if _valid_interval(widget_value) else family_defaults[family]
            )

        return {
            "clock": family_defaults["clock"],
            "calendar": family_defaults["calendar"],
            "widgets": resolved_widgets,
        }

    def resolve_system_widget_intervals(self) -> dict[str, Any]:
        family_defaults: dict[str, int] = {}
        resolved_widgets: dict[str, int] = {}
        for widget_id, (family, app_key, fallback) in SYSTEM_WIDGET_INTERVALS.items():
            if family not in family_defaults:
                app_value = self.storage.get_value("app", app_key)
                family_defaults[family] = app_value if _valid_interval(app_value) else fallback

            widget_value = self.storage.get_value("widgets", "updateInterval", widget_id)
            resolved_widgets[widget_id] = (
                widget_value if _valid_interval(widget_value) else family_defaults[family]
            )

        return {
            "fast": family_defaults["fast"],
            "standard": family_defaults["standard"],
            "slow": family_defaults["slow"],
            "widgets": resolved_widgets,
        }
