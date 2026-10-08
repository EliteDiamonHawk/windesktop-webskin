"""Optional LibreHardwareMonitor integration used by system metrics."""

from __future__ import annotations

import logging
import math
import threading
import time
from collections.abc import Callable, Iterable
from copy import deepcopy
from typing import Any

logger = logging.getLogger(__name__)


_UNIT_BY_TYPE = {
    "temperature": "°C",
    "fan": "RPM",
    "voltage": "V",
    "power": "W",
    "current": "A",
    "clock": "MHz",
    "frequency": "MHz",
    "load": "%",
    "level": "%",
    "battery": "%",
}


def _number(value: Any) -> int | float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        converted = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(converted):
        return None
    return int(converted) if converted.is_integer() else converted


def _text(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    return str(value)


def _normalized_type(value: Any) -> str:
    text = _text(value, "other").strip()
    if "." in text:
        text = text.rsplit(".", 1)[-1]
    if text.lower().endswith("type"):
        text = text[:-4]
    return text.replace(" ", "_").replace("-", "_").lower() or "other"


def _get(value: Any, name: str, default: Any = None) -> Any:
    if isinstance(value, dict):
        return value.get(name, default)
    return getattr(value, name, default)


def _iter_hardware(computer: Any) -> Iterable[Any]:
    def visit(hardware: Any) -> Iterable[Any]:
        yield hardware
        for child in _get(hardware, "SubHardware", []) or []:
            yield from visit(child)

    for hardware in _get(computer, "Hardware", []) or []:
        yield from visit(hardware)


def _iter_sensors(hardware: Any) -> Iterable[tuple[Any, int]]:
    for index, sensor in enumerate(_get(hardware, "Sensors", []) or []):
        yield sensor, index


def _sensor_record(hardware: Any, sensor: Any, index: int) -> dict[str, Any]:
    hardware_id = _text(_get(hardware, "Identifier"), _text(_get(hardware, "Name"), "hardware"))
    hardware_name = _text(_get(hardware, "Name"), hardware_id)
    hardware_type = _normalized_type(_get(hardware, "HardwareType", "other"))
    sensor_type = _normalized_type(_get(sensor, "SensorType", "other"))
    name = _text(_get(sensor, "Name"), f"{sensor_type}-{index + 1}")
    sensor_id = _text(
        _get(sensor, "Identifier"),
        f"{hardware_id}/{sensor_type}/{index}",
    )
    return {
        "id": sensor_id,
        "hardware_id": hardware_id,
        "hardware_name": hardware_name,
        "hardware_type": hardware_type,
        "name": name,
        "type": sensor_type,
        "value": _number(_get(sensor, "Value")),
        "unit": _text(_get(sensor, "Unit"), _UNIT_BY_TYPE.get(sensor_type, "")),
        "minimum": _number(_get(sensor, "Min")),
        "maximum": _number(_get(sensor, "Max")),
        "source": "hardware_monitor",
    }


class HardwareMonitorProvider:
    """Thread-safe, cached and optional wrapper around PyHardwareMonitor."""

    def __init__(
        self,
        *,
        enabled: bool = True,
        cache_ttl: float = 1.0,
        factory: Callable[[], Any] | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._enabled = enabled
        self._cache_ttl = cache_ttl
        self._factory = factory
        self._clock = clock
        self._lock = threading.RLock()
        self._computer: Any | None = None
        self._initialization_attempted = False
        self._unavailable = False
        self._cached_at: float | None = None
        self._cached_readings: list[dict[str, Any]] = []

    def _default_factory(self) -> Callable[[], Any] | None:
        try:
            from HardwareMonitor.Util import OpenComputer
        except Exception:
            logger.debug("HardwareMonitor package is unavailable", exc_info=True)
            return None
        return lambda: OpenComputer(all=True)

    def _ensure_computer(self) -> Any | None:
        if self._unavailable:
            return None
        if self._computer is not None:
            return self._computer
        if self._initialization_attempted:
            return None

        self._initialization_attempted = True
        factory = self._factory or self._default_factory()
        if factory is None:
            self._unavailable = True
            return None
        try:
            self._computer = factory()
            return self._computer
        except Exception:
            self._unavailable = True
            logger.warning("HardwareMonitor could not be initialized", exc_info=True)
            return None

    def read(self) -> dict[str, Any]:
        with self._lock:
            if not self._enabled:
                return {"available": False, "readings": []}
            now = self._clock()
            if self._cached_at is not None and now - self._cached_at < self._cache_ttl:
                return {"available": bool(self._cached_readings), "readings": deepcopy(self._cached_readings)}

            computer = self._ensure_computer()
            if computer is None:
                return {"available": False, "readings": []}

            try:
                update = getattr(computer, "Update", None)
                if callable(update):
                    update()
                readings = [
                    _sensor_record(hardware, sensor, index)
                    for hardware in _iter_hardware(computer)
                    for sensor, index in _iter_sensors(hardware)
                ]
            except Exception:
                self._unavailable = True
                logger.warning("HardwareMonitor sensor update failed", exc_info=True)
                return {"available": False, "readings": []}

            self._cached_at = now
            self._cached_readings = readings
            return {"available": bool(readings), "readings": deepcopy(readings)}

    def close(self) -> None:
        with self._lock:
            if not self._enabled:
                return
            computer, self._computer = self._computer, None
            if computer is None:
                return
            try:
                close = getattr(computer, "Close", None)
                if callable(close):
                    close()
            except Exception:
                logger.warning("HardwareMonitor shutdown failed", exc_info=True)
