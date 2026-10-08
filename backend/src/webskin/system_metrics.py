"""Privacy-filtered operating-system metrics for system widgets."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import psutil


def _number(value: Any) -> int | float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int | float):
        return value
    return None


def _average(values: list[int | float]) -> float | None:
    return sum(values) / len(values) if values else None


def _is_local_mountpoint(mountpoint: str) -> bool:
    normalized = mountpoint.replace("\\", "/")
    return not normalized.startswith("//")


def _available(value: Any, **fields: Any) -> dict[str, Any]:
    return {"available": value, **fields}


def _cpu() -> dict[str, Any]:
    try:
        per_core = [value for value in psutil.cpu_percent(interval=0.1, percpu=True)]
        utilization = _available(
            bool(per_core),
            overall=_average(per_core),
            per_core=per_core,
        )
    except (OSError, RuntimeError, NotImplementedError):
        utilization = _available(False, overall=None, per_core=[])

    try:
        physical = psutil.cpu_count(logical=False)
        logical = psutil.cpu_count(logical=True)
        cores = {"available": physical is not None or logical is not None, "physical": physical, "logical": logical}
    except (OSError, RuntimeError, NotImplementedError):
        cores = {"available": False, "physical": None, "logical": None}

    try:
        frequencies = psutil.cpu_freq(percpu=True)
        if frequencies:
            current = [_number(item.current) for item in frequencies]
            minimum = [_number(item.min) for item in frequencies]
            maximum = [_number(item.max) for item in frequencies]
            frequency = _available(
                True,
                current_mhz=_average([value for value in current if value is not None]),
                minimum_mhz=_average([value for value in minimum if value is not None]),
                maximum_mhz=_average([value for value in maximum if value is not None]),
                per_core=[
                    {
                        "current_mhz": _number(item.current),
                        "minimum_mhz": _number(item.min),
                        "maximum_mhz": _number(item.max),
                    }
                    for item in frequencies
                ],
            )
        else:
            overall = psutil.cpu_freq()
            frequency = _available(
                overall is not None,
                current_mhz=_number(getattr(overall, "current", None)),
                minimum_mhz=_number(getattr(overall, "min", None)),
                maximum_mhz=_number(getattr(overall, "max", None)),
                per_core=[],
            )
    except (OSError, RuntimeError, NotImplementedError):
        frequency = _available(False, current_mhz=None, minimum_mhz=None, maximum_mhz=None, per_core=[])

    try:
        stats = psutil.cpu_stats()
        telemetry = _available(
            True,
            interrupts=_number(getattr(stats, "interrupts", None)),
            system_calls=_number(getattr(stats, "syscalls", None)),
            context_switches=_number(getattr(stats, "ctx_switches", None)),
        )
    except (OSError, RuntimeError, NotImplementedError):
        telemetry = _available(False, interrupts=None, system_calls=None, context_switches=None)

    try:
        loads = psutil.getloadavg()
        load_average = _available(
            True,
            one_minute=_number(loads[0]),
            five_minutes=_number(loads[1]),
            fifteen_minutes=_number(loads[2]),
        )
    except (AttributeError, OSError, RuntimeError, NotImplementedError):
        load_average = _available(False, one_minute=None, five_minutes=None, fifteen_minutes=None)

    return {
        "utilization": utilization,
        "cores": cores,
        "frequencies": frequency,
        "telemetry": telemetry,
        "load_average": load_average,
    }


def _memory() -> dict[str, Any]:
    try:
        memory = psutil.virtual_memory()
        virtual = _available(
            True,
            total_bytes=_number(memory.total),
            available_bytes=_number(memory.available),
            used_bytes=_number(memory.used),
            free_bytes=_number(memory.free),
            percent=_number(memory.percent),
        )
    except (OSError, RuntimeError, NotImplementedError):
        virtual = _available(False, total_bytes=None, available_bytes=None, used_bytes=None, free_bytes=None, percent=None)

    try:
        swap = psutil.swap_memory()
        paging = _available(
            True,
            total_bytes=_number(swap.total),
            used_bytes=_number(swap.used),
            free_bytes=_number(swap.free),
            percent=_number(swap.percent),
        )
    except (OSError, RuntimeError, NotImplementedError):
        paging = _available(False, total_bytes=None, used_bytes=None, free_bytes=None, percent=None)

    return {"available": virtual["available"] or paging["available"], "virtual": virtual, "swap": paging}


def _disks() -> dict[str, Any]:
    partitions: list[dict[str, Any]] = []
    try:
        for partition in psutil.disk_partitions(all=False):
            mountpoint = str(partition.mountpoint)
            if not _is_local_mountpoint(mountpoint):
                continue
            partitions.append(
                {
                    "mount_point": mountpoint,
                    "filesystem": str(partition.fstype),
                    "mount_options": str(partition.opts),
                }
            )
    except (OSError, RuntimeError, NotImplementedError):
        pass

    usage: list[dict[str, Any]] = []
    for partition in partitions:
        try:
            value = psutil.disk_usage(partition["mount_point"])
            usage.append(
                {
                    "available": True,
                    "mount_point": partition["mount_point"],
                    "total_bytes": _number(value.total),
                    "used_bytes": _number(value.used),
                    "free_bytes": _number(value.free),
                    "percent": _number(value.percent),
                }
            )
        except (OSError, RuntimeError, ValueError, NotImplementedError):
            usage.append(
                {
                    "available": False,
                    "mount_point": partition["mount_point"],
                    "total_bytes": None,
                    "used_bytes": None,
                    "free_bytes": None,
                    "percent": None,
                }
            )

    try:
        io = psutil.disk_io_counters(perdisk=False)
        disk_io = _available(
            io is not None,
            read_count=_number(getattr(io, "read_count", None)),
            write_count=_number(getattr(io, "write_count", None)),
            read_bytes=_number(getattr(io, "read_bytes", None)),
            write_bytes=_number(getattr(io, "write_bytes", None)),
            read_time_ms=_number(getattr(io, "read_time", None)),
            write_time_ms=_number(getattr(io, "write_time", None)),
            busy_time_ms=_number(getattr(io, "busy_time", None)),
        )
    except (OSError, RuntimeError, NotImplementedError):
        disk_io = _available(False, read_count=None, write_count=None, read_bytes=None, write_bytes=None, read_time_ms=None, write_time_ms=None, busy_time_ms=None)

    return {
        "available": bool(partitions or usage or disk_io["available"]),
        "partitions": partitions,
        "usage": usage,
        "io": disk_io,
    }


def _network() -> dict[str, Any]:
    try:
        counters = psutil.net_io_counters(pernic=False)
        if counters is None:
            raise OSError("network counters unavailable")
        return _available(
            True,
            bytes_sent=_number(counters.bytes_sent),
            bytes_received=_number(counters.bytes_recv),
            packets_dropped=(_number(counters.dropin) or 0) + (_number(counters.dropout) or 0),
            transmission_errors=(_number(counters.errin) or 0) + (_number(counters.errout) or 0),
        )
    except (OSError, RuntimeError, NotImplementedError):
        return _available(False, bytes_sent=None, bytes_received=None, packets_dropped=None, transmission_errors=None)


def _sensors() -> dict[str, Any]:
    temperatures: list[dict[str, Any]] = []
    fans: list[dict[str, Any]] = []
    try:
        for group, readings in psutil.sensors_temperatures(fahrenheit=False).items():
            for index, reading in enumerate(readings):
                temperatures.append(
                    {
                        "label": str(reading.label or group or f"temperature-{index + 1}"),
                        "current_c": _number(reading.current),
                        "minimum_c": _number(reading.min),
                        "maximum_c": _number(reading.max),
                        "critical_c": _number(reading.critical),
                    }
                )
    except (AttributeError, OSError, RuntimeError, NotImplementedError):
        temperatures = []

    try:
        for group, readings in psutil.sensors_fans().items():
            for index, reading in enumerate(readings):
                fans.append(
                    {
                        "label": str(reading.label or group or f"fan-{index + 1}"),
                        "current_rpm": _number(reading.current),
                    }
                )
    except (AttributeError, OSError, RuntimeError, NotImplementedError):
        fans = []

    return {
        "available": bool(temperatures or fans),
        "temperatures": temperatures,
        "fans": fans,
    }


def collect_system_metrics() -> dict[str, Any]:
    """Return only local aggregate telemetry safe for browser widgets."""
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cpu": _cpu(),
        "memory": _memory(),
        "disks": _disks(),
        "network": _network(),
        "sensors": _sensors(),
    }
