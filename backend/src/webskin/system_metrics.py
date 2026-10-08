"""Privacy-filtered operating-system and hardware metrics for system widgets."""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any

import psutil

from .hardware_monitor import HardwareMonitorProvider


_UNAVAILABLE = object()
_PSUTIL_FAILURES = (AttributeError, OSError, RuntimeError, TypeError, ValueError, NotImplementedError)


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


class PsutilCapabilityTracker:
    """Disable repeatedly failing psutil capabilities for this process."""

    def __init__(self, failure_threshold: int = 3) -> None:
        self.failure_threshold = failure_threshold
        self.failures: dict[str, int] = {}
        self.unavailable: set[str] = set()

    def call(self, capability: str, operation, *, empty_is_failure: bool = False) -> Any:
        if capability in self.unavailable:
            return _UNAVAILABLE
        try:
            result = operation()
        except _PSUTIL_FAILURES:
            failures = self.failures.get(capability, 0) + 1
            self.failures[capability] = failures
            if failures >= self.failure_threshold:
                self.unavailable.add(capability)
            return _UNAVAILABLE
        if empty_is_failure and not result:
            failures = self.failures.get(capability, 0) + 1
            self.failures[capability] = failures
            if failures >= self.failure_threshold:
                self.unavailable.add(capability)
            return _UNAVAILABLE
        self.failures.pop(capability, None)
        return result


def _cpu(tracker: PsutilCapabilityTracker) -> dict[str, Any]:
    per_core = tracker.call("cpu_utilization", lambda: list(psutil.cpu_percent(interval=0.1, percpu=True)), empty_is_failure=True)
    if per_core is _UNAVAILABLE:
        utilization = _available(False, overall=None, per_core=[])
    else:
        utilization = _available(bool(per_core), overall=_average(per_core), per_core=per_core)

    counts = tracker.call("cpu_counts", lambda: (psutil.cpu_count(logical=False), psutil.cpu_count(logical=True)))
    if counts is _UNAVAILABLE:
        cores = {"available": False, "physical": None, "logical": None}
    else:
        physical, logical = counts
        cores = {"available": physical is not None or logical is not None, "physical": physical, "logical": logical}

    def read_frequency():
        frequencies = psutil.cpu_freq(percpu=True)
        if frequencies:
            return ("per_core", frequencies)
        return ("overall", psutil.cpu_freq())

    frequency_result = tracker.call("cpu_frequency", read_frequency, empty_is_failure=True)
    if frequency_result is _UNAVAILABLE:
        frequency = _available(False, current_mhz=None, minimum_mhz=None, maximum_mhz=None, per_core=[])
    elif frequency_result[0] == "per_core":
        frequencies = frequency_result[1]
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
        overall = frequency_result[1]
        frequency = _available(
            overall is not None,
            current_mhz=_number(getattr(overall, "current", None)),
            minimum_mhz=_number(getattr(overall, "min", None)),
            maximum_mhz=_number(getattr(overall, "max", None)),
            per_core=[],
        )

    stats = tracker.call("cpu_telemetry", psutil.cpu_stats)
    if stats is _UNAVAILABLE:
        telemetry = _available(False, interrupts=None, system_calls=None, context_switches=None)
    else:
        telemetry = _available(
            True,
            interrupts=_number(getattr(stats, "interrupts", None)),
            system_calls=_number(getattr(stats, "syscalls", None)),
            context_switches=_number(getattr(stats, "ctx_switches", None)),
        )

    loads = tracker.call("load_average", psutil.getloadavg, empty_is_failure=True)
    if loads is _UNAVAILABLE:
        load_average = _available(False, one_minute=None, five_minutes=None, fifteen_minutes=None)
    else:
        load_average = _available(
            True,
            one_minute=_number(loads[0]),
            five_minutes=_number(loads[1]),
            fifteen_minutes=_number(loads[2]),
        )

    return {
        "utilization": utilization,
        "cores": cores,
        "frequencies": frequency,
        "telemetry": telemetry,
        "load_average": load_average,
    }


def _memory(tracker: PsutilCapabilityTracker) -> dict[str, Any]:
    memory = tracker.call("virtual_memory", psutil.virtual_memory)
    if memory is _UNAVAILABLE:
        virtual = _available(False, total_bytes=None, available_bytes=None, used_bytes=None, free_bytes=None, percent=None)
    else:
        virtual = _available(
            True,
            total_bytes=_number(memory.total),
            available_bytes=_number(memory.available),
            used_bytes=_number(memory.used),
            free_bytes=_number(memory.free),
            percent=_number(memory.percent),
        )

    swap = tracker.call("swap_memory", psutil.swap_memory)
    if swap is _UNAVAILABLE:
        paging = _available(False, total_bytes=None, used_bytes=None, free_bytes=None, percent=None)
    else:
        paging = _available(
            True,
            total_bytes=_number(swap.total),
            used_bytes=_number(swap.used),
            free_bytes=_number(swap.free),
            percent=_number(swap.percent),
        )

    return {"available": virtual["available"] or paging["available"], "virtual": virtual, "swap": paging}


def _disks(tracker: PsutilCapabilityTracker) -> dict[str, Any]:
    raw_partitions = tracker.call("disk_partitions", lambda: psutil.disk_partitions(all=False))
    partitions: list[dict[str, Any]] = []
    if raw_partitions is not _UNAVAILABLE:
        for partition in raw_partitions:
            mountpoint = str(partition.mountpoint)
            if _is_local_mountpoint(mountpoint):
                partitions.append(
                    {
                        "mount_point": mountpoint,
                        "filesystem": str(partition.fstype),
                        "mount_options": str(partition.opts),
                    }
                )

    usage: list[dict[str, Any]] = []
    for partition in partitions:
        value = tracker.call("disk_usage", lambda path=partition["mount_point"]: psutil.disk_usage(path))
        if value is _UNAVAILABLE:
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
        else:
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

    io = tracker.call("disk_io", lambda: psutil.disk_io_counters(perdisk=False), empty_is_failure=True)
    if io is _UNAVAILABLE:
        disk_io = _available(False, read_count=None, write_count=None, read_bytes=None, write_bytes=None, read_time_ms=None, write_time_ms=None, busy_time_ms=None)
    else:
        disk_io = _available(
            True,
            read_count=_number(getattr(io, "read_count", None)),
            write_count=_number(getattr(io, "write_count", None)),
            read_bytes=_number(getattr(io, "read_bytes", None)),
            write_bytes=_number(getattr(io, "write_bytes", None)),
            read_time_ms=_number(getattr(io, "read_time", None)),
            write_time_ms=_number(getattr(io, "write_time", None)),
            busy_time_ms=_number(getattr(io, "busy_time", None)),
        )

    return {"available": bool(partitions or usage or disk_io["available"]), "partitions": partitions, "usage": usage, "io": disk_io}


def _network(tracker: PsutilCapabilityTracker) -> dict[str, Any]:
    counters = tracker.call("network_io", lambda: psutil.net_io_counters(pernic=False), empty_is_failure=True)
    if counters is _UNAVAILABLE:
        return _available(False, bytes_sent=None, bytes_received=None, packets_dropped=None, transmission_errors=None)
    return _available(
        True,
        bytes_sent=_number(counters.bytes_sent),
        bytes_received=_number(counters.bytes_recv),
        packets_dropped=(_number(counters.dropin) or 0) + (_number(counters.dropout) or 0),
        transmission_errors=(_number(counters.errin) or 0) + (_number(counters.errout) or 0),
    )


def _psutil_temperature_records(raw: Any) -> list[dict[str, Any]]:
    records = []
    for group, readings in raw.items():
        for index, reading in enumerate(readings):
            label = str(reading.label or group or f"temperature-{index + 1}")
            records.append(
                {
                    "id": f"psutil:temperature:{group}:{index}",
                    "hardware_id": str(group),
                    "hardware_name": str(group),
                    "hardware_type": "unknown",
                    "name": label,
                    "type": "temperature",
                    "value": _number(reading.current),
                    "unit": "°C",
                    "minimum": _number(reading.min),
                    "maximum": _number(reading.max),
                    "source": "psutil",
                    "critical": _number(reading.critical),
                }
            )
    return records


def _psutil_fan_records(raw: Any) -> list[dict[str, Any]]:
    records = []
    for group, readings in raw.items():
        for index, reading in enumerate(readings):
            label = str(reading.label or group or f"fan-{index + 1}")
            records.append(
                {
                    "id": f"psutil:fan:{group}:{index}",
                    "hardware_id": str(group),
                    "hardware_name": str(group),
                    "hardware_type": "unknown",
                    "name": label,
                    "type": "fan",
                    "value": _number(reading.current),
                    "unit": "RPM",
                    "minimum": None,
                    "maximum": None,
                    "source": "psutil",
                }
            )
    return records


def _legacy_temperature(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "label": record["name"],
        "current_c": record["value"],
        "minimum_c": record["minimum"],
        "maximum_c": record["maximum"],
        "critical_c": record.get("critical"),
    }


def _legacy_fan(record: dict[str, Any]) -> dict[str, Any]:
    return {"label": record["name"], "current_rpm": record["value"]}


def _is_battery_record(record: dict[str, Any]) -> bool:
    return record["type"] in {"battery", "level"} or "battery" in record["hardware_type"] or "battery" in record["hardware_name"].lower()


def _battery_from_record(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "available": record["value"] is not None,
        "percent": record["value"],
        "seconds_left": None,
        "power_plugged": None,
        "source": record["source"],
    }


def _sensors(tracker: PsutilCapabilityTracker, hardware_monitor: HardwareMonitorProvider) -> dict[str, Any]:
    raw_temperatures = tracker.call("temperatures", lambda: psutil.sensors_temperatures(fahrenheit=False), empty_is_failure=True)
    raw_fans = tracker.call("fans", lambda: psutil.sensors_fans(), empty_is_failure=True)
    raw_battery = tracker.call("battery", lambda: psutil.sensors_battery(), empty_is_failure=True)

    psutil_temperatures = [] if raw_temperatures is _UNAVAILABLE else _psutil_temperature_records(raw_temperatures)
    psutil_fans = [] if raw_fans is _UNAVAILABLE else _psutil_fan_records(raw_fans)
    psutil_battery = None if raw_battery is _UNAVAILABLE else raw_battery

    hardware_snapshot = hardware_monitor.read()
    hardware_readings = hardware_snapshot["readings"]
    hardware_temperatures = [record for record in hardware_readings if record["type"] == "temperature"]
    hardware_fans = [record for record in hardware_readings if record["type"] == "fan"]

    temperature_records = psutil_temperatures or hardware_temperatures
    fan_records = psutil_fans or hardware_fans
    readings = list(temperature_records) + list(fan_records)

    ignored_hardware_ids = {record["id"] for record in temperature_records + fan_records if record["source"] == "hardware_monitor"}
    for record in hardware_readings:
        if record["id"] in ignored_hardware_ids:
            continue
        if record["type"] == "temperature" and psutil_temperatures:
            continue
        if record["type"] == "fan" and psutil_fans:
            continue
        readings.append(record)

    if psutil_battery is not None:
        battery = {
            "available": True,
            "percent": _number(getattr(psutil_battery, "percent", None)),
            "seconds_left": _number(getattr(psutil_battery, "secsleft", None)),
            "power_plugged": getattr(psutil_battery, "power_plugged", None),
            "source": "psutil",
        }
        readings.append(
            {
                "id": "psutil:battery:0",
                "hardware_id": "battery",
                "hardware_name": "Battery",
                "hardware_type": "battery",
                "name": "Battery",
                "type": "battery",
                "value": battery["percent"],
                "unit": "%",
                "minimum": None,
                "maximum": None,
                "source": "psutil",
            }
        )
    else:
        hardware_battery = next((record for record in hardware_readings if _is_battery_record(record)), None)
        battery = _battery_from_record(hardware_battery) if hardware_battery else {
            "available": False,
            "percent": None,
            "seconds_left": None,
            "power_plugged": None,
            "source": None,
        }

    return {
        "available": bool(readings),
        "temperatures": [_legacy_temperature(record) for record in temperature_records],
        "fans": [_legacy_fan(record) for record in fan_records],
        "battery": battery,
        "readings": readings,
    }


class SystemMetricsService:
    """Central system metrics service with process-lifetime provider state."""

    def __init__(
        self,
        hardware_monitor: HardwareMonitorProvider | None = None,
        *,
        hardware_monitor_enabled: bool = True,
    ) -> None:
        self._lock = threading.RLock()
        self._tracker = PsutilCapabilityTracker()
        self._hardware_monitor = (
            hardware_monitor
            if hardware_monitor is not None
            else HardwareMonitorProvider(enabled=hardware_monitor_enabled)
        )

    def collect(self) -> dict[str, Any]:
        with self._lock:
            return {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "cpu": _cpu(self._tracker),
                "memory": _memory(self._tracker),
                "disks": _disks(self._tracker),
                "network": _network(self._tracker),
                "sensors": _sensors(self._tracker, self._hardware_monitor),
            }

    def close(self) -> None:
        with self._lock:
            self._hardware_monitor.close()


def collect_system_metrics(
    hardware_monitor: HardwareMonitorProvider | None = None,
    *,
    hardware_monitor_enabled: bool = True,
) -> dict[str, Any]:
    """Return local aggregate telemetry safe for browser widgets."""
    return SystemMetricsService(
        hardware_monitor=hardware_monitor,
        hardware_monitor_enabled=hardware_monitor_enabled,
    ).collect()
