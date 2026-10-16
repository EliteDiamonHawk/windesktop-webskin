from __future__ import annotations

import unittest

from webskin.settings import COMMON_WIDGET_IDS, SettingsService


class MemorySettingsStorage:
    def __init__(self, values: dict[tuple[str, str, str | None], object]) -> None:
        self.values = values

    def get_namespace(self, namespace: str, identifier: str | None = None) -> dict[str, object]:
        return {
            key: value
            for (stored_namespace, key, stored_identifier), value in self.values.items()
            if stored_namespace == namespace and stored_identifier == identifier
        }

    def get_value(self, namespace: str, key: str, identifier: str | None = None) -> object:
        from webskin.persistence import _MISSING

        return self.values.get((namespace, key, identifier), _MISSING)

    def set_value(self, namespace: str, key: str, value: object, identifier: str | None = None) -> None:
        self.values[(namespace, key, identifier)] = value

    def delete_value(self, namespace: str, key: str, identifier: str | None = None) -> bool:
        return self.values.pop((namespace, key, identifier), None) is not None


class TimeWidgetSettingsTests(unittest.TestCase):
    def test_widget_settings_override_app_settings(self) -> None:
        service = SettingsService(MemorySettingsStorage({
            ("app", "time_clock_update_interval_seconds", None): 5,
            ("app", "time_calendar_update_interval_seconds", None): 60,
            ("widgets", "updateInterval", "digital-plain"): 2,
            ("widgets", "updateInterval", "month-prestyled"): 15,
        }))

        resolved = service.resolve_time_widget_intervals()
        self.assertEqual(resolved["clock"], 5)
        self.assertEqual(resolved["calendar"], 60)
        self.assertEqual(resolved["widgets"]["digital-plain"], 2)
        self.assertEqual(resolved["widgets"]["analog-plain"], 5)
        self.assertEqual(resolved["widgets"]["month-prestyled"], 15)

    def test_invalid_widget_and_app_values_use_family_defaults(self) -> None:
        service = SettingsService(MemorySettingsStorage({
            ("app", "time_clock_update_interval_seconds", None): 0,
            ("widgets", "updateInterval", "calendar"): 2,
            ("widgets", "updateInterval", "day-plain"): "slow",
        }))

        resolved = service.resolve_time_widget_intervals()
        self.assertEqual(resolved["clock"], 5)
        self.assertEqual(resolved["calendar"], 60)
        self.assertEqual(resolved["widgets"]["digital-plain"], 5)
        self.assertEqual(resolved["widgets"]["day-plain"], 60)

    def test_legacy_family_entries_are_ignored(self) -> None:
        service = SettingsService(MemorySettingsStorage({
            ("app", "time_clock_update_interval_seconds", None): 5,
            ("app", "time_calendar_update_interval_seconds", None): 60,
            ("widgets", "updateInterval", "clock"): 1,
            ("widgets", "updateInterval", "calendar"): 2,
        }))

        resolved = service.resolve_time_widget_intervals()
        self.assertEqual(resolved["widgets"]["digital-plain"], 5)
        self.assertEqual(resolved["widgets"]["day-plain"], 60)

    def test_common_widget_registry_is_hardcoded(self) -> None:
        self.assertTrue(SettingsService.is_common_widget("digital-plain"))
        self.assertFalse(SettingsService.is_common_widget("clock-digital-plain"))
        self.assertTrue(SettingsService.is_common_widget("memory-plain"))
        self.assertTrue(SettingsService.is_common_widget("last-boot-plain"))
        self.assertFalse(SettingsService.is_common_widget("main-clock"))
        self.assertEqual(len(COMMON_WIDGET_IDS), 30)

    def test_system_widget_family_and_widget_overrides(self) -> None:
        service = SettingsService(MemorySettingsStorage({
            ("app", "system_fast_update_interval_seconds", None): 5,
            ("app", "system_standard_update_interval_seconds", None): 30,
            ("app", "system_slow_update_interval_seconds", None): 60,
            ("widgets", "updateInterval", "memory-plain"): 15,
            ("widgets", "updateInterval", "disk-partitions-plain"): 0,
        }))

        resolved = service.resolve_system_widget_intervals()
        self.assertEqual(resolved["fast"], 5)
        self.assertEqual(resolved["standard"], 30)
        self.assertEqual(resolved["slow"], 60)
        self.assertEqual(resolved["widgets"]["memory-plain"], 15)
        self.assertEqual(resolved["widgets"]["disk-partitions-plain"], 60)

    def test_invalid_system_app_values_use_family_defaults(self) -> None:
        service = SettingsService(MemorySettingsStorage({
            ("app", "system_fast_update_interval_seconds", None): 0,
            ("app", "system_standard_update_interval_seconds", None): "slow",
            ("app", "system_slow_update_interval_seconds", None): 120,
        }))

        resolved = service.resolve_system_widget_intervals()
        self.assertEqual(resolved["fast"], 5)
        self.assertEqual(resolved["standard"], 30)
        self.assertEqual(resolved["slow"], 120)


if __name__ == "__main__":
    unittest.main()
