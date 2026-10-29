from __future__ import annotations

import unittest
from unittest.mock import patch

from webskin.routes import create_system_time_router
from webskin.system_time import get_system_time


class SystemTimeTests(unittest.TestCase):
    def test_system_time_returns_epoch_milliseconds(self) -> None:
        with patch("webskin.system_time.time.time_ns", return_value=1_700_000_000_123_456_789):
            self.assertEqual(get_system_time(), {"epochMilliseconds": 1_700_000_000_123})

    def test_route_returns_injected_clock_value(self) -> None:
        router = create_system_time_router(lambda: {"epochMilliseconds": 123})
        endpoint = next(route.endpoint for route in router.routes if route.path == "/api/system/time")
        self.assertEqual(endpoint(), {"epochMilliseconds": 123})


if __name__ == "__main__":
    unittest.main()
