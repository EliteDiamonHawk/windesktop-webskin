from __future__ import annotations

import unittest

from fastapi import HTTPException

from webskin.routes import create_settings_router
from webskin.settings import SettingsService

from test_settings import MemorySettingsStorage


class SettingsRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = SettingsService(MemorySettingsStorage({}))
        self.router = create_settings_router(self.service)
        self.set_scoped_value = next(
            route.endpoint
            for route in self.router.routes
            if route.path == "/api/settings/{namespace}/{identifier}/{key}"
            and "PUT" in route.methods
        )

    def test_invalid_widget_ids_are_rejected(self) -> None:
        with self.assertRaises(HTTPException) as context:
            self.set_scoped_value("widgets", "../memory-plain", "updateInterval", 1)
        self.assertEqual(context.exception.status_code, 404)

    def test_custom_widget_settings_are_writable(self) -> None:
        self.assertEqual(
            self.set_scoped_value("widgets", "theme-clock", "updateInterval", 1),
            1,
        )

    def test_system_interval_resolution_route(self) -> None:
        endpoint = next(
            route.endpoint
            for route in self.router.routes
            if route.path == "/api/settings/widgets/system-intervals"
        )
        self.assertEqual(endpoint()["fast"], 5)
        self.assertEqual(endpoint()["standard"], 30)
        self.assertEqual(endpoint()["slow"], 60)


if __name__ == "__main__":
    unittest.main()
