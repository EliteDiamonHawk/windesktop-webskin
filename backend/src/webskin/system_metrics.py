"""Privacy-filtered operating-system and hardware metrics for system widgets."""

from __future__ import annotations

import asyncio
import concurrent.futures
import copy
import logging
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import psutil

from .hardware_monitor import HardwareMonitorProvider


logger = logging.getLogger(__name__)

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


def _field_requested(requested_fields: set[str] | None, path: str) -> bool:
    if requested_fields is None:
        return True
    return any(
        field == path or field.startswith(f"{path}.") or path.startswith(f"{field}.")
        for field in requested_fields
    )


class PsutilCapabilityTracker:
    """Disable repeatedly failing psutil capabilities for this process."""

    def __init__(self, failure_threshold: int = 3, failure_cooldown: float = 30.0, clock=time.monotonic) -> None:
        self.failure_threshold = failure_threshold
        self.failure_cooldown = failure_cooldown
        self.clock = clock
        self.failures: dict[str, int] = {}
        self.unavailable: set[str] = set()
        self.unavailable_until: dict[str, float] = {}
        self._locks_lock = threading.Lock()
        self._capability_locks: dict[str, threading.Lock] = {}

    def _lock_for(self, capability: str) -> threading.Lock:
        with self._locks_lock:
            lock = self._capability_locks.get(capability)
            if lock is None:
                lock = threading.Lock()
                self._capability_locks[capability] = lock
            return lock

    def call(self, capability: str, operation, *, empty_is_failure: bool = False) -> Any:
        with self._lock_for(capability):
            if capability in self.unavailable:
                if self.clock() < self.unavailable_until.get(capability, 0.0):
                    return _UNAVAILABLE
                self.unavailable.discard(capability)
                self.failures.pop(capability, None)
            try:
                result = operation()
            except _PSUTIL_FAILURES:
                failures = self.failures.get(capability, 0) + 1
                self.failures[capability] = failures
                if failures >= self.failure_threshold:
                    self.unavailable.add(capability)
                    self.unavailable_until[capability] = self.clock() + self.failure_cooldown
                return _UNAVAILABLE
            if empty_is_failure and not result:
                failures = self.failures.get(capability, 0) + 1
                self.failures[capability] = failures
                if failures >= self.failure_threshold:
                    self.unavailable.add(capability)
                    self.unavailable_until[capability] = self.clock() + self.failure_cooldown
                return _UNAVAILABLE
            self.failures.pop(capability, None)
            self.unavailable.discard(capability)
            self.unavailable_until.pop(capability, None)
            return result


class DiskMetricsCache:
    """Cache disk inventory and capacity data independently from live counters."""

    def __init__(
        self,
        *,
        partition_ttl: float = 60.0,
        usage_ttl: float = 30.0,
        clock=time.monotonic,
    ) -> None:
        self.partition_ttl = partition_ttl
        self.usage_ttl = usage_ttl
        self.clock = clock
        self._lock = threading.RLock()
        self.partitions_at: float | None = None
        self.partitions: list[dict[str, str]] = []
        self.usage: dict[str, tuple[float, Any]] = {}

    def get_partitions(self, tracker: PsutilCapabilityTracker) -> list[dict[str, str]] | object:
        with self._lock:
            now = self.clock()
            if self.partitions_at is not None and now - self.partitions_at < self.partition_ttl:
                return self.partitions

            raw_partitions = tracker.call("disk_partitions", lambda: psutil.disk_partitions(all=False))
            if raw_partitions is _UNAVAILABLE:
                return _UNAVAILABLE

            self.partitions = [
                {
                    "mount_point": str(partition.mountpoint),
                    "filesystem": str(partition.fstype),
                    "mount_options": str(partition.opts),
                }
                for partition in raw_partitions
                if _is_local_mountpoint(str(partition.mountpoint))
            ]
            self.partitions_at = now
            active_mounts = {partition["mount_point"] for partition in self.partitions}
            self.usage = {
                mount_point: value
                for mount_point, value in self.usage.items()
                if mount_point in active_mounts
            }
            return self.partitions

    def get_usage(self, mount_point: str, tracker: PsutilCapabilityTracker) -> Any:
        with self._lock:
            now = self.clock()
            cached = self.usage.get(mount_point)
            if cached is not None and now - cached[0] < self.usage_ttl:
                return cached[1]

            value = tracker.call("disk_usage", lambda: psutil.disk_usage(mount_point))
            if value is not _UNAVAILABLE:
                self.usage[mount_point] = (now, value)
            return value


def _cpu(tracker: PsutilCapabilityTracker, requested_fields: set[str] | None = None) -> dict[str, Any]:
    utilization_requested = _field_requested(requested_fields, "cpu.utilization")
    if utilization_requested:
        overall_requested = _field_requested(requested_fields, "cpu.utilization.overall")
        per_core_requested = _field_requested(requested_fields, "cpu.utilization.per_core")
        if per_core_requested:
            per_core = tracker.call("cpu_utilization_per_core", lambda: list(psutil.cpu_percent(interval=0.1, percpu=True)), empty_is_failure=True)
            if per_core is _UNAVAILABLE:
                utilization = _available(False, overall=None, per_core=[])
            else:
                utilization = _available(
                    bool(per_core),
                    overall=_average(per_core) if overall_requested else None,
                    per_core=per_core,
                )
        elif overall_requested:
            overall = tracker.call("cpu_utilization_overall", lambda: psutil.cpu_percent(interval=0.1, percpu=False))
            utilization = _available(
                overall is not _UNAVAILABLE,
                overall=_number(overall) if overall is not _UNAVAILABLE else None,
                per_core=[],
            )
        else:
            utilization = _available(
                False,
                overall=None,
                per_core=[],
            )
    else:
        utilization = _available(False, overall=None, per_core=[])

    counts_requested = _field_requested(requested_fields, "cpu.cores")
    if counts_requested:
        physical = tracker.call("cpu_count_physical", lambda: psutil.cpu_count(logical=False)) if _field_requested(requested_fields, "cpu.cores.physical") else None
        logical = tracker.call("cpu_count_logical", lambda: psutil.cpu_count(logical=True)) if _field_requested(requested_fields, "cpu.cores.logical") else None
        cores = {
            "available": (physical is not _UNAVAILABLE and physical is not None) or (logical is not _UNAVAILABLE and logical is not None),
            "physical": physical if physical is not _UNAVAILABLE else None,
            "logical": logical if logical is not _UNAVAILABLE else None,
        }
    else:
        cores = {"available": False, "physical": None, "logical": None}

    frequency_requested = _field_requested(requested_fields, "cpu.frequencies")
    if frequency_requested:
        aggregate_requested = any(_field_requested(requested_fields, field) for field in (
            "cpu.frequencies.current_mhz",
            "cpu.frequencies.minimum_mhz",
            "cpu.frequencies.maximum_mhz",
        ))
        per_core_requested = _field_requested(requested_fields, "cpu.frequencies.per_core")
        frequency_result = _UNAVAILABLE
        if per_core_requested:
            frequency_result = tracker.call("cpu_frequency_per_core", lambda: psutil.cpu_freq(percpu=True), empty_is_failure=True)
        if frequency_result is not _UNAVAILABLE and frequency_result:
            frequencies = frequency_result
            current = [_number(item.current) for item in frequencies]
            minimum = [_number(item.min) for item in frequencies]
            maximum = [_number(item.max) for item in frequencies]
            frequency = _available(
                True,
                current_mhz=_average([value for value in current if value is not None]) if _field_requested(requested_fields, "cpu.frequencies.current_mhz") else None,
                minimum_mhz=_average([value for value in minimum if value is not None]) if _field_requested(requested_fields, "cpu.frequencies.minimum_mhz") else None,
                maximum_mhz=_average([value for value in maximum if value is not None]) if _field_requested(requested_fields, "cpu.frequencies.maximum_mhz") else None,
                per_core=[
                    {
                        "current_mhz": _number(item.current) if _field_requested(requested_fields, "cpu.frequencies.per_core.current_mhz") else None,
                        "minimum_mhz": _number(item.min) if _field_requested(requested_fields, "cpu.frequencies.per_core.minimum_mhz") else None,
                        "maximum_mhz": _number(item.max) if _field_requested(requested_fields, "cpu.frequencies.per_core.maximum_mhz") else None,
                    }
                    for item in frequencies
                ],
            )
        elif aggregate_requested:
            overall = tracker.call("cpu_frequency", lambda: psutil.cpu_freq(percpu=False))
            frequency = _available(
                overall is not _UNAVAILABLE and overall is not None,
                current_mhz=_number(getattr(overall, "current", None)) if overall is not _UNAVAILABLE and _field_requested(requested_fields, "cpu.frequencies.current_mhz") else None,
                minimum_mhz=_number(getattr(overall, "min", None)) if overall is not _UNAVAILABLE and _field_requested(requested_fields, "cpu.frequencies.minimum_mhz") else None,
                maximum_mhz=_number(getattr(overall, "max", None)) if overall is not _UNAVAILABLE and _field_requested(requested_fields, "cpu.frequencies.maximum_mhz") else None,
                per_core=[],
            )
        else:
            frequency = _available(False, current_mhz=None, minimum_mhz=None, maximum_mhz=None, per_core=[])
    else:
        frequency = _available(False, current_mhz=None, minimum_mhz=None, maximum_mhz=None, per_core=[])

    telemetry_requested = _field_requested(requested_fields, "cpu.telemetry")
    if telemetry_requested:
        stats = tracker.call("cpu_telemetry", psutil.cpu_stats)
        if stats is _UNAVAILABLE:
            telemetry = _available(False, interrupts=None, system_calls=None, context_switches=None)
        else:
            telemetry = _available(
                True,
                interrupts=_number(getattr(stats, "interrupts", None)) if _field_requested(requested_fields, "cpu.telemetry.interrupts") else None,
                system_calls=_number(getattr(stats, "syscalls", None)) if _field_requested(requested_fields, "cpu.telemetry.system_calls") else None,
                context_switches=_number(getattr(stats, "ctx_switches", None)) if _field_requested(requested_fields, "cpu.telemetry.context_switches") else None,
            )
    else:
        telemetry = _available(False, interrupts=None, system_calls=None, context_switches=None)

    load_requested = _field_requested(requested_fields, "cpu.load_average")
    if load_requested:
        loads = tracker.call("load_average", psutil.getloadavg, empty_is_failure=True)
        if loads is _UNAVAILABLE:
            load_average = _available(False, one_minute=None, five_minutes=None, fifteen_minutes=None)
        else:
            load_average = _available(
                True,
                one_minute=_number(loads[0]) if _field_requested(requested_fields, "cpu.load_average.one_minute") else None,
                five_minutes=_number(loads[1]) if _field_requested(requested_fields, "cpu.load_average.five_minutes") else None,
                fifteen_minutes=_number(loads[2]) if _field_requested(requested_fields, "cpu.load_average.fifteen_minutes") else None,
            )
    else:
        load_average = _available(False, one_minute=None, five_minutes=None, fifteen_minutes=None)

    return {
        "utilization": utilization,
        "cores": cores,
        "frequencies": frequency,
        "telemetry": telemetry,
        "load_average": load_average,
    }


def _memory(tracker: PsutilCapabilityTracker, requested_fields: set[str] | None = None) -> dict[str, Any]:
    virtual_requested = _field_requested(requested_fields, "memory.virtual")
    if virtual_requested:
        memory = tracker.call("virtual_memory", psutil.virtual_memory)
        if memory is _UNAVAILABLE:
            virtual = _available(False, total_bytes=None, available_bytes=None, used_bytes=None, free_bytes=None, percent=None)
        else:
            virtual = _available(
                True,
                total_bytes=_number(memory.total) if _field_requested(requested_fields, "memory.virtual.total_bytes") else None,
                available_bytes=_number(memory.available) if _field_requested(requested_fields, "memory.virtual.available_bytes") else None,
                used_bytes=_number(memory.used) if _field_requested(requested_fields, "memory.virtual.used_bytes") else None,
                free_bytes=_number(memory.free) if _field_requested(requested_fields, "memory.virtual.free_bytes") else None,
                percent=_number(memory.percent) if _field_requested(requested_fields, "memory.virtual.percent") else None,
            )
    else:
        virtual = _available(False, total_bytes=None, available_bytes=None, used_bytes=None, free_bytes=None, percent=None)

    swap_requested = _field_requested(requested_fields, "memory.swap")
    if swap_requested:
        swap = tracker.call("swap_memory", psutil.swap_memory)
        if swap is _UNAVAILABLE:
            paging = _available(False, total_bytes=None, used_bytes=None, free_bytes=None, percent=None)
        else:
            paging = _available(
                True,
                total_bytes=_number(swap.total) if _field_requested(requested_fields, "memory.swap.total_bytes") else None,
                used_bytes=_number(swap.used) if _field_requested(requested_fields, "memory.swap.used_bytes") else None,
                free_bytes=_number(swap.free) if _field_requested(requested_fields, "memory.swap.free_bytes") else None,
                percent=_number(swap.percent) if _field_requested(requested_fields, "memory.swap.percent") else None,
            )
    else:
        paging = _available(False, total_bytes=None, used_bytes=None, free_bytes=None, percent=None)

    return {"available": virtual["available"] or paging["available"], "virtual": virtual, "swap": paging}


def _disks(
    tracker: PsutilCapabilityTracker,
    requested_fields: set[str] | None = None,
    cache: DiskMetricsCache | None = None,
) -> dict[str, Any]:
    partitions_requested = _field_requested(requested_fields, "disks.partitions")
    usage_requested = _field_requested(requested_fields, "disks.usage")
    disk_cache = cache or DiskMetricsCache()
    if partitions_requested or usage_requested:
        raw_partitions = disk_cache.get_partitions(tracker)
    else:
        raw_partitions = _UNAVAILABLE

    all_partitions = [] if raw_partitions is _UNAVAILABLE else raw_partitions

    partitions = [
        {
            "mount_point": partition["mount_point"] if _field_requested(requested_fields, "disks.partitions.mount_point") else None,
            "filesystem": partition["filesystem"] if _field_requested(requested_fields, "disks.partitions.filesystem") else None,
            "mount_options": partition["mount_options"] if _field_requested(requested_fields, "disks.partitions.mount_options") else None,
        }
        for partition in all_partitions
    ] if partitions_requested else []

    usage: list[dict[str, Any]] = []
    if usage_requested:
        for partition in all_partitions:
            value = disk_cache.get_usage(partition["mount_point"], tracker)
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
                        "total_bytes": _number(value.total) if _field_requested(requested_fields, "disks.usage.total_bytes") else None,
                        "used_bytes": _number(value.used) if _field_requested(requested_fields, "disks.usage.used_bytes") else None,
                        "free_bytes": _number(value.free) if _field_requested(requested_fields, "disks.usage.free_bytes") else None,
                        "percent": _number(value.percent) if _field_requested(requested_fields, "disks.usage.percent") else None,
                    }
                )

    io_requested = _field_requested(requested_fields, "disks.io")
    if io_requested:
        io = tracker.call("disk_io", lambda: psutil.disk_io_counters(perdisk=False), empty_is_failure=True)
        if io is _UNAVAILABLE:
            disk_io = _available(False, read_count=None, write_count=None, read_bytes=None, write_bytes=None, read_time_ms=None, write_time_ms=None, busy_time_ms=None)
        else:
            disk_io = _available(
                True,
                read_count=_number(getattr(io, "read_count", None)) if _field_requested(requested_fields, "disks.io.read_count") else None,
                write_count=_number(getattr(io, "write_count", None)) if _field_requested(requested_fields, "disks.io.write_count") else None,
                read_bytes=_number(getattr(io, "read_bytes", None)) if _field_requested(requested_fields, "disks.io.read_bytes") else None,
                write_bytes=_number(getattr(io, "write_bytes", None)) if _field_requested(requested_fields, "disks.io.write_bytes") else None,
                read_time_ms=_number(getattr(io, "read_time", None)) if _field_requested(requested_fields, "disks.io.read_time_ms") else None,
                write_time_ms=_number(getattr(io, "write_time", None)) if _field_requested(requested_fields, "disks.io.write_time_ms") else None,
                busy_time_ms=_number(getattr(io, "busy_time", None)) if _field_requested(requested_fields, "disks.io.busy_time_ms") else None,
            )
    else:
        disk_io = _available(False, read_count=None, write_count=None, read_bytes=None, write_bytes=None, read_time_ms=None, write_time_ms=None, busy_time_ms=None)

    return {"available": bool(partitions or usage or disk_io["available"]), "partitions": partitions, "usage": usage, "io": disk_io}


def _network(tracker: PsutilCapabilityTracker, requested_fields: set[str] | None = None) -> dict[str, Any]:
    if not _field_requested(requested_fields, "network"):
        return _available(False, bytes_sent=None, bytes_received=None, packets_dropped=None, transmission_errors=None)
    counters = tracker.call("network_io", lambda: psutil.net_io_counters(pernic=False), empty_is_failure=True)
    if counters is _UNAVAILABLE:
        return _available(False, bytes_sent=None, bytes_received=None, packets_dropped=None, transmission_errors=None)
    return _available(
        True,
        bytes_sent=_number(counters.bytes_sent) if _field_requested(requested_fields, "network.bytes_sent") else None,
        bytes_received=_number(counters.bytes_recv) if _field_requested(requested_fields, "network.bytes_received") else None,
        packets_dropped=((_number(counters.dropin) or 0) + (_number(counters.dropout) or 0)) if _field_requested(requested_fields, "network.packets_dropped") else None,
        transmission_errors=((_number(counters.errin) or 0) + (_number(counters.errout) or 0)) if _field_requested(requested_fields, "network.transmission_errors") else None,
    )


def _system(
    tracker: PsutilCapabilityTracker,
    requested_fields: set[str] | None = None,
) -> dict[str, Any]:
    if not _field_requested(requested_fields, "system"):
        return _available(False, boot_time=None)

    boot_epoch = tracker.call("system_boot_time", lambda: psutil.boot_time())
    if boot_epoch is _UNAVAILABLE or not isinstance(boot_epoch, int | float) or isinstance(boot_epoch, bool):
        return _available(False, boot_time=None)

    try:
        boot_time = datetime.fromtimestamp(float(boot_epoch), timezone.utc).isoformat()
    except (OverflowError, OSError, ValueError):
        return _available(False, boot_time=None)

    return _available(
        True,
        boot_time=boot_time if _field_requested(requested_fields, "system.boot_time") else None,
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
                    "warning": None,
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
                    "warning": None,
                    "critical": None,
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


def _sensors(
    tracker: PsutilCapabilityTracker,
    hardware_monitor: HardwareMonitorProvider,
    requested_fields: set[str] | None = None,
) -> dict[str, Any]:
    readings_requested = _field_requested(requested_fields, "sensors.readings")
    temperatures_requested = _field_requested(requested_fields, "sensors.temperatures") or readings_requested
    fans_requested = _field_requested(requested_fields, "sensors.fans") or readings_requested
    battery_requested = _field_requested(requested_fields, "sensors.battery")
    if not temperatures_requested and not fans_requested and not battery_requested:
        return {"available": False, "temperatures": [], "fans": [], "battery": {"available": False, "percent": None, "seconds_left": None, "power_plugged": None, "source": None}, "readings": []}

    raw_temperatures = tracker.call("temperatures", lambda: psutil.sensors_temperatures(fahrenheit=False), empty_is_failure=True) if temperatures_requested else _UNAVAILABLE
    raw_fans = tracker.call("fans", lambda: psutil.sensors_fans(), empty_is_failure=True) if fans_requested else _UNAVAILABLE
    raw_battery = tracker.call("battery", lambda: psutil.sensors_battery(), empty_is_failure=True) if battery_requested else _UNAVAILABLE

    psutil_temperatures = [] if raw_temperatures is _UNAVAILABLE else _psutil_temperature_records(raw_temperatures)
    psutil_fans = [] if raw_fans is _UNAVAILABLE else _psutil_fan_records(raw_fans)
    psutil_battery = None if raw_battery is _UNAVAILABLE else raw_battery

    hardware_requested = (
        readings_requested
        or (temperatures_requested and not psutil_temperatures)
        or (fans_requested and not psutil_fans)
        or (battery_requested and psutil_battery is None)
    )
    hardware_snapshot = hardware_monitor.read() if hardware_requested else {"available": False, "readings": []}
    hardware_readings = hardware_snapshot["readings"]
    hardware_temperatures = [record for record in hardware_readings if record["type"] == "temperature"]
    hardware_fans = [record for record in hardware_readings if record["type"] == "fan"]

    temperature_records = (psutil_temperatures or hardware_temperatures) if temperatures_requested else []
    fan_records = (psutil_fans or hardware_fans) if fans_requested else []
    readings = list(temperature_records) + list(fan_records) if readings_requested else []

    ignored_hardware_ids = {record["id"] for record in temperature_records + fan_records if record["source"] == "hardware_monitor"}
    for record in hardware_readings:
        if not readings_requested:
            break
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
            "percent": _number(getattr(psutil_battery, "percent", None)) if _field_requested(requested_fields, "sensors.battery.percent") else None,
            "seconds_left": _number(getattr(psutil_battery, "secsleft", None)) if _field_requested(requested_fields, "sensors.battery.seconds_left") else None,
            "power_plugged": getattr(psutil_battery, "power_plugged", None) if _field_requested(requested_fields, "sensors.battery.power_plugged") else None,
            "source": "psutil",
        }
        if readings_requested:
            readings.append(
                {
                    "id": "psutil:battery:0",
                    "hardware_id": "battery",
                    "hardware_name": "Battery",
                    "hardware_type": "battery",
                    "name": "Battery",
                    "type": "battery",
                    "value": _number(getattr(psutil_battery, "percent", None)),
                    "unit": "%",
                    "minimum": None,
                    "maximum": None,
                    "warning": None,
                    "source": "psutil",
                }
            )
    else:
        hardware_battery = next((record for record in hardware_readings if _is_battery_record(record)), None) if battery_requested else None
        if hardware_battery:
            fallback_battery = _battery_from_record(hardware_battery)
            battery = {
                "available": fallback_battery["available"],
                "percent": fallback_battery["percent"] if _field_requested(requested_fields, "sensors.battery.percent") else None,
                "seconds_left": None,
                "power_plugged": None,
                "source": fallback_battery["source"],
            }
        else:
            battery = {
                "available": False,
                "percent": None,
                "seconds_left": None,
                "power_plugged": None,
                "source": None,
            }

    return {
        "available": bool(readings or temperature_records or fan_records or battery["available"]),
        "temperatures": [_legacy_temperature(record) for record in temperature_records] if temperatures_requested else [],
        "fans": [_legacy_fan(record) for record in fan_records] if fans_requested else [],
        "battery": battery,
        "readings": readings,
    }


@dataclass(frozen=True)
class _SourceResult:
    fragment: dict[str, Any]
    provided_fields: frozenset[str]
    success: bool = True


@dataclass(frozen=True)
class _SourceCacheEntry:
    fragment: dict[str, Any]
    provided_fields: frozenset[str]
    collected_at: float


_SOURCE_FIELDS: dict[str, frozenset[str]] = {
    "system_boot": frozenset({"system.boot_time"}),
    "cpu_utilization_overall": frozenset({"cpu.utilization.overall"}),
    "cpu_utilization_per_core": frozenset({"cpu.utilization.overall", "cpu.utilization.per_core"}),
    "cpu_cores": frozenset({"cpu.cores.physical", "cpu.cores.logical"}),
    "cpu_frequency_overall": frozenset({
        "cpu.frequencies.current_mhz",
        "cpu.frequencies.minimum_mhz",
        "cpu.frequencies.maximum_mhz",
    }),
    "cpu_frequency_per_core": frozenset({
        "cpu.frequencies.current_mhz",
        "cpu.frequencies.minimum_mhz",
        "cpu.frequencies.maximum_mhz",
        "cpu.frequencies.per_core.current_mhz",
        "cpu.frequencies.per_core.minimum_mhz",
        "cpu.frequencies.per_core.maximum_mhz",
    }),
    "cpu_telemetry": frozenset({
        "cpu.telemetry.interrupts",
        "cpu.telemetry.system_calls",
        "cpu.telemetry.context_switches",
    }),
    "cpu_load_average": frozenset({
        "cpu.load_average.one_minute",
        "cpu.load_average.five_minutes",
        "cpu.load_average.fifteen_minutes",
    }),
    "memory_virtual": frozenset({
        "memory.virtual.total_bytes",
        "memory.virtual.available_bytes",
        "memory.virtual.used_bytes",
        "memory.virtual.free_bytes",
        "memory.virtual.percent",
    }),
    "memory_swap": frozenset({
        "memory.swap.total_bytes",
        "memory.swap.used_bytes",
        "memory.swap.free_bytes",
        "memory.swap.percent",
    }),
    "disk_partitions": frozenset({
        "disks.partitions.mount_point",
        "disks.partitions.filesystem",
        "disks.partitions.mount_options",
    }),
    "disk_io": frozenset({
        "disks.io.read_count",
        "disks.io.write_count",
        "disks.io.read_bytes",
        "disks.io.write_bytes",
        "disks.io.read_time_ms",
        "disks.io.write_time_ms",
        "disks.io.busy_time_ms",
    }),
    "network_io": frozenset({
        "network.bytes_sent",
        "network.bytes_received",
        "network.packets_dropped",
        "network.transmission_errors",
    }),
    "sensor_temperatures": frozenset({"sensors.temperatures"}),
    "sensor_fans": frozenset({"sensors.fans"}),
    "sensor_battery": frozenset({
        "sensors.battery.percent",
        "sensors.battery.seconds_left",
        "sensors.battery.power_plugged",
    }),
    "sensor_readings": frozenset({
        "sensors.temperatures",
        "sensors.fans",
        "sensors.battery.percent",
        "sensors.battery.seconds_left",
        "sensors.battery.power_plugged",
        "sensors.readings",
    }),
}

_SOURCE_TTLS: dict[str, float] = {
    "system_boot": 3600.0,
    "cpu_utilization_overall": 1.0,
    "cpu_utilization_per_core": 1.0,
    "cpu_cores": 3600.0,
    "cpu_frequency_overall": 2.0,
    "cpu_frequency_per_core": 2.0,
    "cpu_telemetry": 5.0,
    "cpu_load_average": 5.0,
    "memory_virtual": 2.0,
    "memory_swap": 2.0,
    "disk_partitions": 60.0,
    "disk_io": 2.0,
    "network_io": 2.0,
    "sensor_temperatures": 2.0,
    "sensor_fans": 2.0,
    "sensor_battery": 10.0,
    "sensor_readings": 2.0,
}

_DISK_USAGE_FIELDS = frozenset({
    "disks.usage.mount_point",
    "disks.usage.total_bytes",
    "disks.usage.used_bytes",
    "disks.usage.free_bytes",
    "disks.usage.percent",
})

SUPPORTED_METRIC_FIELDS = frozenset({
    "system.boot_time",
    "cpu.utilization",
    "cpu.cores",
    "cpu.frequencies",
    "cpu.frequencies.per_core",
    "cpu.telemetry",
    "cpu.load_average",
    "memory.virtual",
    "memory.swap",
    "disks.partitions",
    "disks.usage",
    "disks.io",
    "network",
    "sensors.temperatures",
    "sensors.fans",
    "sensors.battery",
    "sensors.readings",
} | {
    field
    for fields in _SOURCE_FIELDS.values()
    for field in fields
} | set(_DISK_USAGE_FIELDS))


def _empty_metrics_snapshot(
    tracker: PsutilCapabilityTracker,
    hardware_monitor: HardwareMonitorProvider,
    disk_cache: DiskMetricsCache,
) -> dict[str, Any]:
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "system": _system(tracker, set()),
        "cpu": _cpu(tracker, set()),
        "memory": _memory(tracker, set()),
        "disks": _disks(tracker, set(), disk_cache),
        "network": _network(tracker, set()),
        "sensors": _sensors(tracker, hardware_monitor, set()),
    }


def _merge_fragment(snapshot: dict[str, Any], fragment: dict[str, Any]) -> None:
    for group_name, group_value in fragment.items():
        if not isinstance(group_value, dict):
            snapshot[group_name] = copy.deepcopy(group_value)
            continue
        target = snapshot.setdefault(group_name, {})
        for key, value in group_value.items():
            if isinstance(value, dict) and isinstance(target.get(key), dict):
                target[key].update(copy.deepcopy(value))
            elif isinstance(value, list) and isinstance(target.get(key), list):
                if key in {"usage", "readings"}:
                    target[key].extend(copy.deepcopy(value))
                else:
                    target[key] = copy.deepcopy(value)
            elif key == "available":
                target[key] = bool(target.get(key)) or bool(value)
            else:
                target[key] = copy.deepcopy(value)


def _mask_snapshot(snapshot: dict[str, Any], requested_fields: set[str] | None) -> dict[str, Any]:
    if requested_fields is None:
        return snapshot

    system = snapshot["system"]
    if not _field_requested(requested_fields, "system.boot_time"):
        system["boot_time"] = None

    cpu = snapshot["cpu"]
    utilization = cpu["utilization"]
    if not _field_requested(requested_fields, "cpu.utilization.overall"):
        utilization["overall"] = None
    if not _field_requested(requested_fields, "cpu.utilization.per_core"):
        utilization["per_core"] = []
    cores = cpu["cores"]
    if not _field_requested(requested_fields, "cpu.cores.physical"):
        cores["physical"] = None
    if not _field_requested(requested_fields, "cpu.cores.logical"):
        cores["logical"] = None
    frequencies = cpu["frequencies"]
    for field, key in (
        ("cpu.frequencies.current_mhz", "current_mhz"),
        ("cpu.frequencies.minimum_mhz", "minimum_mhz"),
        ("cpu.frequencies.maximum_mhz", "maximum_mhz"),
    ):
        if not _field_requested(requested_fields, field):
            frequencies[key] = None
    if not _field_requested(requested_fields, "cpu.frequencies.per_core"):
        frequencies["per_core"] = []
    else:
        for record in frequencies["per_core"]:
            for field, key in (
                ("cpu.frequencies.per_core.current_mhz", "current_mhz"),
                ("cpu.frequencies.per_core.minimum_mhz", "minimum_mhz"),
                ("cpu.frequencies.per_core.maximum_mhz", "maximum_mhz"),
            ):
                if not _field_requested(requested_fields, field):
                    record[key] = None
    telemetry = cpu["telemetry"]
    for field, key in (
        ("cpu.telemetry.interrupts", "interrupts"),
        ("cpu.telemetry.system_calls", "system_calls"),
        ("cpu.telemetry.context_switches", "context_switches"),
    ):
        if not _field_requested(requested_fields, field):
            telemetry[key] = None
    load_average = cpu["load_average"]
    for field, key in (
        ("cpu.load_average.one_minute", "one_minute"),
        ("cpu.load_average.five_minutes", "five_minutes"),
        ("cpu.load_average.fifteen_minutes", "fifteen_minutes"),
    ):
        if not _field_requested(requested_fields, field):
            load_average[key] = None

    memory = snapshot["memory"]
    virtual = memory["virtual"]
    for field, key in (
        ("memory.virtual.total_bytes", "total_bytes"),
        ("memory.virtual.available_bytes", "available_bytes"),
        ("memory.virtual.used_bytes", "used_bytes"),
        ("memory.virtual.free_bytes", "free_bytes"),
        ("memory.virtual.percent", "percent"),
    ):
        if not _field_requested(requested_fields, field):
            virtual[key] = None
    swap = memory["swap"]
    for field, key in (
        ("memory.swap.total_bytes", "total_bytes"),
        ("memory.swap.used_bytes", "used_bytes"),
        ("memory.swap.free_bytes", "free_bytes"),
        ("memory.swap.percent", "percent"),
    ):
        if not _field_requested(requested_fields, field):
            swap[key] = None

    disks = snapshot["disks"]
    if _field_requested(requested_fields, "disks.partitions"):
        for partition in disks["partitions"]:
            for field, key in (
                ("disks.partitions.mount_point", "mount_point"),
                ("disks.partitions.filesystem", "filesystem"),
                ("disks.partitions.mount_options", "mount_options"),
            ):
                if not _field_requested(requested_fields, field):
                    partition[key] = None
    else:
        disks["partitions"] = []
    if _field_requested(requested_fields, "disks.usage"):
        for usage in disks["usage"]:
            for field, key in (
                ("disks.usage.total_bytes", "total_bytes"),
                ("disks.usage.used_bytes", "used_bytes"),
                ("disks.usage.free_bytes", "free_bytes"),
                ("disks.usage.percent", "percent"),
            ):
                if not _field_requested(requested_fields, field):
                    usage[key] = None
    else:
        disks["usage"] = []
    io = disks["io"]
    for field, key in (
        ("disks.io.read_count", "read_count"),
        ("disks.io.write_count", "write_count"),
        ("disks.io.read_bytes", "read_bytes"),
        ("disks.io.write_bytes", "write_bytes"),
        ("disks.io.read_time_ms", "read_time_ms"),
        ("disks.io.write_time_ms", "write_time_ms"),
        ("disks.io.busy_time_ms", "busy_time_ms"),
    ):
        if not _field_requested(requested_fields, field):
            io[key] = None

    network = snapshot["network"]
    for field, key in (
        ("network.bytes_sent", "bytes_sent"),
        ("network.bytes_received", "bytes_received"),
        ("network.packets_dropped", "packets_dropped"),
        ("network.transmission_errors", "transmission_errors"),
    ):
        if not _field_requested(requested_fields, field):
            network[key] = None

    sensors = snapshot["sensors"]
    readings_requested = _field_requested(requested_fields, "sensors.readings")
    if not readings_requested and not _field_requested(requested_fields, "sensors.temperatures"):
        sensors["temperatures"] = []
    if not readings_requested and not _field_requested(requested_fields, "sensors.fans"):
        sensors["fans"] = []
    if not _field_requested(requested_fields, "sensors.battery"):
        sensors["battery"] = {
            "available": False,
            "percent": None,
            "seconds_left": None,
            "power_plugged": None,
            "source": None,
        }
    if not readings_requested:
        sensors["readings"] = []
    return snapshot


class _CachedHardwareMonitor:
    def __init__(self, service: "SystemMetricsService") -> None:
        self._service = service

    def read(self) -> dict[str, Any]:
        return self._service._read_hardware_snapshot()


class SystemMetricsService:
    """Unified source registry, cache, collector, and subscription owner."""

    def __init__(
        self,
        hardware_monitor: HardwareMonitorProvider | None = None,
        *,
        hardware_monitor_enabled: bool = True,
        cache_ttl: float | None = None,
        clock=time.monotonic,
    ) -> None:
        self._tracker = PsutilCapabilityTracker(clock=clock)
        self._clock = clock
        self._cache_ttl_override = cache_ttl
        self._ttl_overrides = {key: cache_ttl for key in _SOURCE_TTLS} if cache_ttl is not None else {}
        self._disk_cache = DiskMetricsCache(
            partition_ttl=cache_ttl if cache_ttl is not None else 60.0,
            usage_ttl=cache_ttl if cache_ttl is not None else 30.0,
            clock=clock,
        )
        self._hardware_monitor = (
            hardware_monitor
            if hardware_monitor is not None
            else HardwareMonitorProvider(enabled=hardware_monitor_enabled)
        )
        self._hardware_cache_lock = threading.Lock()
        self._hardware_cached_at: float | None = None
        self._hardware_cached_snapshot: dict[str, Any] | None = None
        self._sensor_monitor = _CachedHardwareMonitor(self)
        self._cache_lock = threading.RLock()
        self._source_cache: dict[str, _SourceCacheEntry] = {}
        self._inflight: dict[str, concurrent.futures.Future[_SourceResult]] = {}
        self._failure_until: dict[str, float] = {}
        self._failure_cooldown = 30.0
        self._cache_limit = 256
        self._source_executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=8,
            thread_name_prefix="webskin-metric-source",
        )
        self._orchestration_executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=4,
            thread_name_prefix="webskin-metric-request",
        )
        from .metrics_streams import MetricsSubscriptionManager

        self.subscriptions = MetricsSubscriptionManager(self)

    def _read_hardware_snapshot(self) -> dict[str, Any]:
        with self._hardware_cache_lock:
            now = self._clock()
            if (
                self._hardware_cached_snapshot is not None
                and self._hardware_cached_at is not None
                and now - self._hardware_cached_at < self._source_ttl("sensor_readings")
            ):
                return self._hardware_cached_snapshot
            snapshot = self._hardware_monitor.read()
            self._hardware_cached_snapshot = snapshot
            self._hardware_cached_at = now
            return snapshot

    def _source_fields(self, key: str) -> frozenset[str]:
        if key.startswith("disk_usage:"):
            return _DISK_USAGE_FIELDS
        return _SOURCE_FIELDS[key]

    def _source_ttl(self, key: str) -> float:
        if key.startswith("disk_usage:"):
            return self._cache_ttl_override if self._cache_ttl_override is not None else 30.0
        return self._ttl_overrides.get(key, _SOURCE_TTLS[key])

    def _source_keys(self, requested_fields: set[str] | None) -> set[str]:
        if requested_fields is None:
            keys = set(_SOURCE_FIELDS)
            keys.difference_update({"sensor_temperatures", "sensor_fans", "sensor_battery"})
            keys.difference_update({"cpu_utilization_overall", "cpu_frequency_overall"})
            return keys
        if not requested_fields:
            return set()
        keys = {
            key
            for key, fields in _SOURCE_FIELDS.items()
            if any(_field_requested(requested_fields, field) for field in fields)
        }
        if _field_requested(requested_fields, "sensors.readings"):
            keys.difference_update({"sensor_temperatures", "sensor_fans", "sensor_battery"})
            keys.add("sensor_readings")
        if _field_requested(requested_fields, "cpu.utilization.per_core"):
            keys.discard("cpu_utilization_overall")
        elif _field_requested(requested_fields, "cpu.utilization.overall"):
            keys.discard("cpu_utilization_per_core")
        if _field_requested(requested_fields, "cpu.frequencies.per_core"):
            keys.discard("cpu_frequency_overall")
        elif any(_field_requested(requested_fields, field) for field in (
            "cpu.frequencies.current_mhz",
            "cpu.frequencies.minimum_mhz",
            "cpu.frequencies.maximum_mhz",
        )):
            keys.discard("cpu_frequency_per_core")
        if _field_requested(requested_fields, "disks.usage"):
            keys.add("disk_partitions")
        return keys

    def _fresh(self, key: str, entry: _SourceCacheEntry, now: float) -> bool:
        if now < entry.collected_at or now - entry.collected_at >= self._source_ttl(key):
            return False
        return self._source_fields(key).issubset(entry.provided_fields)

    def _failure_result(self, key: str) -> _SourceResult:
        return _SourceResult({}, self._source_fields(key), success=False)

    def _acquire_source(self, key: str) -> _SourceResult | concurrent.futures.Future[_SourceResult]:
        now = self._clock()
        with self._cache_lock:
            entry = self._source_cache.get(key)
            if entry is not None and self._fresh(key, entry, now):
                return _SourceResult(entry.fragment, entry.provided_fields)
            alternate = {
                "cpu_utilization_overall": "cpu_utilization_per_core",
                "cpu_frequency_overall": "cpu_frequency_per_core",
            }.get(key)
            if alternate is not None:
                alternate_entry = self._source_cache.get(alternate)
                if alternate_entry is not None and self._fresh(key, alternate_entry, now):
                    return _SourceResult(alternate_entry.fragment, alternate_entry.provided_fields)
            if now < self._failure_until.get(key, 0.0):
                return self._failure_result(key)
            future = self._inflight.get(key)
            if future is None:
                future = self._source_executor.submit(self._run_source, key)
                self._inflight[key] = future
                future.add_done_callback(lambda completed: self._complete_source(key, completed))
            return future

    def _complete_source(self, key: str, future: concurrent.futures.Future[_SourceResult]) -> None:
        try:
            result = future.result()
        except Exception:
            result = self._failure_result(key)
        now = self._clock()
        with self._cache_lock:
            if self._inflight.get(key) is future:
                self._inflight.pop(key, None)
            if result.success:
                self._source_cache[key] = _SourceCacheEntry(
                    result.fragment,
                    result.provided_fields,
                    now,
                )
                self._failure_until.pop(key, None)
            else:
                self._failure_until[key] = now + self._failure_cooldown
                self._source_cache.pop(key, None)

    def _run_source(self, key: str) -> _SourceResult:
        try:
            return self._collect_source(key)
        except Exception:
            logger.warning("System metric source failed: %s", key, exc_info=True)
            return self._failure_result(key)

    def _collect_source(self, key: str) -> _SourceResult:
        fields = self._source_fields(key)
        if key == "system_boot":
            value = _system(self._tracker, fields)
            return _SourceResult({"system": value}, fields, value["available"])
        if key == "cpu_utilization_overall":
            value = _cpu(self._tracker, fields)["utilization"]
            return _SourceResult({"cpu": {"utilization": value}}, fields, value["available"])
        if key == "cpu_utilization_per_core":
            value = _cpu(self._tracker, fields)["utilization"]
            return _SourceResult({"cpu": {"utilization": value}}, fields, value["available"])
        if key == "cpu_cores":
            value = _cpu(self._tracker, fields)["cores"]
            return _SourceResult({"cpu": {"cores": value}}, fields, value["available"])
        if key == "cpu_frequency_overall":
            value = _cpu(self._tracker, fields)["frequencies"]
            return _SourceResult({"cpu": {"frequencies": value}}, fields, value["available"])
        if key == "cpu_frequency_per_core":
            value = _cpu(self._tracker, fields)["frequencies"]
            return _SourceResult({"cpu": {"frequencies": value}}, fields, value["available"])
        if key == "cpu_telemetry":
            value = _cpu(self._tracker, fields)["telemetry"]
            return _SourceResult({"cpu": {"telemetry": value}}, fields, value["available"])
        if key == "cpu_load_average":
            value = _cpu(self._tracker, fields)["load_average"]
            return _SourceResult({"cpu": {"load_average": value}}, fields, value["available"])
        if key == "memory_virtual":
            value = _memory(self._tracker, fields)["virtual"]
            return _SourceResult({"memory": {"virtual": value}}, fields, value["available"])
        if key == "memory_swap":
            value = _memory(self._tracker, fields)["swap"]
            return _SourceResult({"memory": {"swap": value}}, fields, value["available"])
        if key == "disk_partitions":
            raw_partitions = self._disk_cache.get_partitions(self._tracker)
            if raw_partitions is _UNAVAILABLE:
                return self._failure_result(key)
            partitions = [
                {
                    "mount_point": partition["mount_point"],
                    "filesystem": partition["filesystem"],
                    "mount_options": partition["mount_options"],
                }
                for partition in raw_partitions
            ]
            return _SourceResult({"disks": {"partitions": partitions}}, fields)
        if key == "disk_io":
            value = _disks(self._tracker, fields, self._disk_cache)["io"]
            return _SourceResult({"disks": {"io": value}}, fields, value["available"])
        if key == "network_io":
            value = _network(self._tracker, fields)
            return _SourceResult({"network": value}, fields, value["available"])
        if key == "sensor_temperatures":
            value = _sensors(self._tracker, self._sensor_monitor, fields)
            return _SourceResult({"sensors": {"temperatures": value["temperatures"]}}, fields, value["available"])
        if key == "sensor_fans":
            value = _sensors(self._tracker, self._sensor_monitor, fields)
            return _SourceResult({"sensors": {"fans": value["fans"]}}, fields, value["available"])
        if key == "sensor_battery":
            value = _sensors(self._tracker, self._sensor_monitor, fields)
            return _SourceResult({"sensors": {"battery": value["battery"]}}, fields, value["available"])
        if key == "sensor_readings":
            value = _sensors(self._tracker, self._sensor_monitor, fields)
            return _SourceResult({"sensors": {
                "temperatures": value["temperatures"],
                "fans": value["fans"],
                "battery": value["battery"],
                "readings": value["readings"],
            }}, fields, value["available"])
        if key.startswith("disk_usage:"):
            mount_point = key.split(":", 1)[1]
            value = self._disk_cache.get_usage(mount_point, self._tracker)
            if value is _UNAVAILABLE:
                return self._failure_result(key)
            usage = {
                "available": True,
                "mount_point": mount_point,
                "total_bytes": _number(value.total),
                "used_bytes": _number(value.used),
                "free_bytes": _number(value.free),
                "percent": _number(value.percent),
            }
            return _SourceResult({"disks": {"usage": [usage]}}, fields)
        raise KeyError(key)

    def _cleanup_cache(self) -> None:
        now = self._clock()
        with self._cache_lock:
            for key, entry in list(self._source_cache.items()):
                if key.startswith("disk_usage:") and now - entry.collected_at >= self._source_ttl(key):
                    self._source_cache.pop(key, None)
            dynamic = [
                (entry.collected_at, key)
                for key, entry in self._source_cache.items()
                if key.startswith("disk_usage:")
            ]
            for _, key in sorted(dynamic)[:-self._cache_limit]:
                self._source_cache.pop(key, None)

    @staticmethod
    def _resolve_sources(
        pending: dict[str, concurrent.futures.Future[_SourceResult]],
        results: dict[str, _SourceResult],
    ) -> None:
        for key, future in pending.items():
            try:
                results[key] = future.result()
            except Exception:
                results[key] = _SourceResult({}, _SOURCE_FIELDS.get(key, _DISK_USAGE_FIELDS), success=False)

    def collect(self, requested_fields: set[str] | None = None) -> dict[str, Any]:
        requested = None if requested_fields is None else set(requested_fields)
        self._cleanup_cache()
        keys = self._source_keys(requested)
        pending: dict[str, concurrent.futures.Future[_SourceResult]] = {}
        results: dict[str, _SourceResult] = {}
        for key in keys:
            result = self._acquire_source(key)
            if isinstance(result, concurrent.futures.Future):
                pending[key] = result
            else:
                results[key] = result
        self._resolve_sources(pending, results)

        if _field_requested(requested, "disks.usage"):
            partition_result = results.get("disk_partitions")
            partitions = partition_result.fragment.get("disks", {}).get("partitions", []) if partition_result else []
            pending = {}
            for partition in partitions:
                mount_point = partition.get("mount_point")
                if mount_point:
                    key = f"disk_usage:{mount_point}"
                    result = self._acquire_source(key)
                    if isinstance(result, concurrent.futures.Future):
                        pending[key] = result
                    else:
                        results[key] = result
            self._resolve_sources(pending, results)

        snapshot = _empty_metrics_snapshot(self._tracker, self._hardware_monitor, self._disk_cache)
        for result in results.values():
            if result.success:
                _merge_fragment(snapshot, result.fragment)
        snapshot["disks"]["available"] = bool(
            snapshot["disks"]["partitions"]
            or snapshot["disks"]["usage"]
            or snapshot["disks"]["io"]["available"]
        )
        snapshot["sensors"]["available"] = bool(
            snapshot["sensors"]["temperatures"]
            or snapshot["sensors"]["fans"]
            or snapshot["sensors"]["readings"]
            or snapshot["sensors"]["battery"]["available"]
        )
        snapshot["memory"]["available"] = bool(
            snapshot["memory"]["virtual"]["available"]
            or snapshot["memory"]["swap"]["available"]
        )
        snapshot["timestamp"] = datetime.now(timezone.utc).isoformat()
        return _mask_snapshot(snapshot, requested)

    async def collect_async(self, requested_fields: set[str] | None = None) -> dict[str, Any]:
        loop = asyncio.get_running_loop()
        requested = None if requested_fields is None else set(requested_fields)
        return await loop.run_in_executor(self._orchestration_executor, self.collect, requested)

    def project_snapshot(self, snapshot: dict[str, Any], requested_fields: set[str] | None) -> dict[str, Any]:
        return _mask_snapshot(copy.deepcopy(snapshot), requested_fields)

    def close(self) -> None:
        self.subscriptions.close()
        self._source_executor.shutdown(wait=True, cancel_futures=True)
        self._orchestration_executor.shutdown(wait=True, cancel_futures=True)
        with self._cache_lock:
            self._source_cache.clear()
            self._inflight.clear()
            self._failure_until.clear()
        with self._hardware_cache_lock:
            self._hardware_cached_at = None
            self._hardware_cached_snapshot = None
        self._hardware_monitor.close()


def collect_system_metrics(
    hardware_monitor: HardwareMonitorProvider | None = None,
    *,
    hardware_monitor_enabled: bool = True,
    requested_fields: set[str] | None = None,
) -> dict[str, Any]:
    """Return local aggregate telemetry safe for browser widgets."""
    service = SystemMetricsService(
        hardware_monitor=hardware_monitor,
        hardware_monitor_enabled=hardware_monitor_enabled,
    )
    try:
        return service.collect(requested_fields)
    finally:
        service.close()
