from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from webskin.system_controls import execute_system_control


class SystemControlTests(unittest.TestCase):
    def test_development_mode_logs_without_running_command(self) -> None:
        with (
            patch.dict(os.environ, {"WEBSKIN_ENV": "development", "WEBSKIN_PRODUCTION": ""}),
            patch("webskin.system_controls.os.system") as system_call,
            patch("builtins.print") as print_call,
        ):
            execute_system_control("shutdown")

        system_call.assert_not_called()
        print_call.assert_called_once_with(
            "[development] System control requested: shutdown (shutdown.exe /s /t 0)",
            flush=True,
        )

    def test_production_mode_runs_command(self) -> None:
        system_call = lambda command: 0
        with patch.dict(os.environ, {"WEBSKIN_ENV": "production", "WEBSKIN_PRODUCTION": ""}):
            with patch("webskin.system_controls.os.system", side_effect=system_call) as mocked_call:
                execute_system_control("restart")

        mocked_call.assert_called_once_with("shutdown.exe /r /t 0")


if __name__ == "__main__":
    unittest.main()
