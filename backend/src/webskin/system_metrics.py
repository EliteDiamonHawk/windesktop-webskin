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


def _field_requested(requested_fields: set[str] | None, path: str) -> bool:
    if requested_fields is None:
        return True
    return any(
        field == path or field.startswith(f"{path}.") or path.startswith(f"{field}.")
        for field in requested_fields
    )


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


def _disks(tracker: PsutilCapabilityTracker, requested_fields: set[str] | None = None) -> dict[str, Any]:
    partitions_requested = _field_requested(requested_fields, "disks.partitions")
    usage_requested = _field_requested(requested_fields, "disks.usage")
    if partitions_requested or usage_requested:
        raw_partitions = tracker.call("disk_partitions", lambda: psutil.disk_partitions(all=False))
    else:
        raw_partitions = _UNAVAILABLE

    all_partitions: list[dict[str, Any]] = []
    if raw_partitions is not _UNAVAILABLE:
        for partition in raw_partitions:
            mountpoint = str(partition.mountpoint)
            if _is_local_mountpoint(mountpoint):
                all_partitions.append(
                    {
                        "mount_point": mountpoint,
                        "filesystem": str(partition.fstype),
                        "mount_options": str(partition.opts),
                    }
                )

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
    hardware_requested = readings_requested or temperatures_requested or fans_requested or battery_requested
    if not hardware_requested:
        return {"available": False, "temperatures": [], "fans": [], "battery": {"available": False, "percent": None, "seconds_left": None, "power_plugged": None, "source": None}, "readings": []}

    raw_temperatures = tracker.call("temperatures", lambda: psutil.sensors_temperatures(fahrenheit=False), empty_is_failure=True) if temperatures_requested else _UNAVAILABLE
    raw_fans = tracker.call("fans", lambda: psutil.sensors_fans(), empty_is_failure=True) if fans_requested else _UNAVAILABLE
    raw_battery = tracker.call("battery", lambda: psutil.sensors_battery(), empty_is_failure=True) if battery_requested else _UNAVAILABLE

    psutil_temperatures = [] if raw_temperatures is _UNAVAILABLE else _psutil_temperature_records(raw_temperatures)
    psutil_fans = [] if raw_fans is _UNAVAILABLE else _psutil_fan_records(raw_fans)
    psutil_battery = None if raw_battery is _UNAVAILABLE else raw_battery

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

    def collect(self, requested_fields: set[str] | None = None) -> dict[str, Any]:
        with self._lock:
            return {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "cpu": _cpu(self._tracker, requested_fields),
                "memory": _memory(self._tracker, requested_fields),
                "disks": _disks(self._tracker, requested_fields),
                "network": _network(self._tracker, requested_fields),
                "sensors": _sensors(self._tracker, self._hardware_monitor, requested_fields),
            }

    def close(self) -> None:
        with self._lock:
            self._hardware_monitor.close()


def collect_system_metrics(
    hardware_monitor: HardwareMonitorProvider | None = None,
    *,
    hardware_monitor_enabled: bool = True,
    requested_fields: set[str] | None = None,
) -> dict[str, Any]:
    """Return local aggregate telemetry safe for browser widgets."""
    return SystemMetricsService(
        hardware_monitor=hardware_monitor,
        hardware_monitor_enabled=hardware_monitor_enabled,
    ).collect(requested_fields)
