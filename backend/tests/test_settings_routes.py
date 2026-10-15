from __future__ import annotations

import unittest

from fastapi import HTTPException

from webskin.routes import create_settings_router
from webskin.settings import SettingsService

from test_settings import MemorySettingsStorage


class SettingsRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = SettingsService(MemorySettingsStorage({}))
        router = create_settings_router(self.service)
        self.set_scoped_value = next(
            route.endpoint
            for route in router.routes
            if route.path == "/api/settings/{namespace}/{identifier}/{key}"
            and "PUT" in route.methods
        )

    def test_unknown_widget_ids_are_rejected(self) -> None:
        with self.assertRaises(HTTPException) as context:
            self.set_scoped_value("widgets", "main-clock", "updateInterval", 1)
        self.assertEqual(context.exception.status_code, 404)

    def test_common_widget_settings_are_writable(self) -> None:
        self.assertEqual(
            self.set_scoped_value("widgets", "clock-digital-plain", "updateInterval", 1),
            1,
        )


if __name__ == "__main__":
    unittest.main()
