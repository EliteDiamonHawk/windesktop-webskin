from __future__ import annotations

import os
import sys
from collections.abc import Callable


SYSTEM_CONTROL_COMMANDS = {
    "sleep": "rundll32.exe powrprof.dll,SetSuspendState 0,1,0",
    "shutdown": "shutdown.exe /s /t 0",
    "lock": "rundll32.exe user32.dll,LockWorkStation",
    "logout": "shutdown.exe /l",
    "restart": "shutdown.exe /r /t 0",
}


class SystemControlError(RuntimeError):
    """Raised when Windows rejects a system-control command."""

    def __init__(self, control: str, return_code: int) -> None:
        super().__init__(f"Windows system control {control!r} failed with code {return_code}")
        self.control = control
        self.return_code = return_code


def _is_development_mode() -> bool:
    environment = os.getenv("WEBSKIN_ENV", "development").casefold()
    production_flag = os.getenv("WEBSKIN_PRODUCTION", "").casefold()
    return not (
        getattr(sys, "frozen", False)
        or environment in {"production", "prod", "release"}
        or production_flag in {"1", "true", "yes"}
    )


def execute_system_control(
    control: str,
    system_call: Callable[[str], int] | None = None,
) -> None:
    """Run one supported Windows system-control command."""
    try:
        command = SYSTEM_CONTROL_COMMANDS[control]
    except KeyError as exc:
        raise ValueError(f"Unsupported system control: {control}") from exc

    if _is_development_mode():
        print(f"[development] System control requested: {control} ({command})", flush=True)
        return

    return_code = (system_call or os.system)(command)
    if return_code != 0:
        raise SystemControlError(control, return_code)

