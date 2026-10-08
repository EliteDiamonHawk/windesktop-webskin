from __future__ import annotations

import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from webskin.main import _hardware_monitor_enabled, lifespan
from webskin.persistence import SettingsStorageError
from webskin.settings import SettingNotFoundError


class HardwareMonitorSettingsTests(unittest.TestCase):
    @staticmethod
    def _service(value=...):
        def get(namespace, key):
            if value is ...:
                raise SettingNotFoundError(key)
            return value

        return SimpleNamespace(get=get)

    def test_missing_setting_defaults_to_enabled(self) -> None:
        self.assertTrue(_hardware_monitor_enabled(self._service()))

    def test_boolean_setting_controls_hardware_monitor(self) -> None:
        self.assertFalse(_hardware_monitor_enabled(self._service(False)))
        self.assertTrue(_hardware_monitor_enabled(self._service(True)))

    def test_invalid_setting_defaults_to_enabled(self) -> None:
        self.assertTrue(_hardware_monitor_enabled(self._service("false")))

    def test_settings_failure_defaults_to_enabled(self) -> None:
        broken_service = SimpleNamespace(
            get=lambda namespace, key: (_ for _ in ()).throw(SettingsStorageError("unreadable"))
        )
        self.assertTrue(_hardware_monitor_enabled(broken_service))

    def test_lifespan_passes_setting_and_closes_metrics_service(self) -> None:
        events = []

        class FakeMetricsService:
            def __init__(self, **kwargs):
                events.append(("create", kwargs))

            def close(self):
                events.append(("close",))

        application = SimpleNamespace(state=SimpleNamespace())
        with patch("webskin.main.settings_service", self._service(False)):
            with patch("webskin.main.SystemMetricsService", FakeMetricsService):
                async def exercise():
                    async with lifespan(application):
                        self.assertIsInstance(application.state.system_metrics, FakeMetricsService)

                asyncio.run(exercise())

        self.assertEqual(events, [("create", {"hardware_monitor_enabled": False}), ("close",)])


if __name__ == "__main__":
    unittest.main()
