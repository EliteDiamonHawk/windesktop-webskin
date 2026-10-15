from __future__ import annotations

from typing import Any

from .persistence import JsonSettingsStorage, SettingsStorage, _MISSING


class SettingNotFoundError(KeyError):
    pass


COMMON_WIDGET_IDS = frozenset({
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
    "clock-digital-plain",
    "clock-digital-prestyled",
    "clock-analog-plain",
    "clock-analog-prestyled",
    "clock-analog-prestyled2",
    "clock-digital-analog-prestyled",
    "clock-digital-day",
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
            "clock-digital-plain",
            "clock-digital-prestyled",
            "clock-analog-plain",
            "clock-analog-prestyled",
            "clock-analog-prestyled2",
            "clock-digital-analog-prestyled",
            "clock-digital-day",
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
