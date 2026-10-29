from __future__ import annotations

import time


def get_system_time() -> dict[str, int]:
    """Return current host time for browser timer synchronization."""
    return {"epochMilliseconds": time.time_ns() // 1_000_000}
