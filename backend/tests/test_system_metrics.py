from __future__ import annotations

import unittest
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import patch

from webskin.hardware_monitor import HardwareMonitorProvider
from webskin.routes import create_system_router
from webskin.system_metrics import PsutilCapabilityTracker, _UNAVAILABLE, _sensors, collect_system_metrics


class SystemMetricsTests(unittest.TestCase):
    @staticmethod
    def _unavailable_hardware_monitor():
        return SimpleNamespace(read=lambda: {"available": False, "readings": []}, close=lambda: None)

    def test_metrics_route_returns_collector_snapshot(self) -> None:
        router = create_system_router(lambda: {"timestamp": "test", "network": {"available": True}})
        route = router.routes[0]

        self.assertEqual(route.path, "/api/system/metrics")
        self.assertEqual(route.endpoint(), {"timestamp": "test", "network": {"available": True}})

    def test_snapshot_contains_requested_aggregate_groups_without_network_identity(self) -> None:
        fake_psutil = SimpleNamespace(
            cpu_percent=lambda interval, percpu: [12.5, 25.0],
            cpu_count=lambda logical: 2 if logical else 1,
            cpu_freq=lambda percpu=False: [
                SimpleNamespace(current=2400, min=800, max=4200),
                SimpleNamespace(current=2500, min=800, max=4200),
            ] if percpu else None,
            cpu_stats=lambda: SimpleNamespace(interrupts=10, syscalls=20, ctx_switches=30),
            getloadavg=lambda: (0.1, 0.2, 0.3),
            virtual_memory=lambda: SimpleNamespace(total=100, available=60, used=40, free=50, percent=40),
            swap_memory=lambda: SimpleNamespace(total=200, used=20, free=180, percent=10),
            disk_partitions=lambda all=False: [
                SimpleNamespace(mountpoint="C:\\", fstype="NTFS", opts="rw"),
                SimpleNamespace(mountpoint="\\\\server\\share", fstype="SMB", opts="rw"),
            ],
            disk_usage=lambda path: SimpleNamespace(total=1000, used=400, free=600, percent=40),
            disk_io_counters=lambda perdisk=False: SimpleNamespace(
                read_count=1, write_count=2, read_bytes=3, write_bytes=4, read_time=5, write_time=6, busy_time=7
            ),
            net_io_counters=lambda pernic=False: SimpleNamespace(
                bytes_sent=1, bytes_recv=2, dropin=3, dropout=4, errin=5, errout=6
            ),
            sensors_temperatures=lambda fahrenheit=False: {},
            sensors_fans=lambda: {},
        )

        with patch("webskin.system_metrics.psutil", fake_psutil):
            snapshot = collect_system_metrics(self._unavailable_hardware_monitor())

        self.assertEqual(snapshot["cpu"]["utilization"]["per_core"], [12.5, 25.0])
        self.assertEqual(snapshot["memory"]["virtual"]["used_bytes"], 40)
        self.assertEqual(len(snapshot["disks"]["partitions"]), 1)
        self.assertEqual(snapshot["network"]["packets_dropped"], 7)
        self.assertEqual(snapshot["network"]["transmission_errors"], 11)
        self.assertNotIn("interfaces", snapshot["network"])
        self.assertNotIn("addresses", snapshot["network"])
        self.assertEqual(snapshot["sensors"]["available"], False)

    def test_unsupported_sensor_and_load_values_are_explicit(self) -> None:
        fake_psutil = SimpleNamespace(
            cpu_percent=lambda interval, percpu: [],
            cpu_count=lambda logical: None,
            cpu_freq=lambda percpu=False: None,
            cpu_stats=lambda: SimpleNamespace(interrupts=None, syscalls=None, ctx_switches=None),
            getloadavg=lambda: (_ for _ in ()).throw(NotImplementedError()),
            virtual_memory=lambda: SimpleNamespace(total=0, available=0, used=0, free=0, percent=0),
            swap_memory=lambda: SimpleNamespace(total=0, used=0, free=0, percent=0),
            disk_partitions=lambda all=False: [],
            disk_usage=lambda path: None,
            disk_io_counters=lambda perdisk=False: None,
            net_io_counters=lambda pernic=False: None,
            sensors_temperatures=lambda fahrenheit=False: (_ for _ in ()).throw(NotImplementedError()),
            sensors_fans=lambda: (_ for _ in ()).throw(NotImplementedError()),
        )

        with patch("webskin.system_metrics.psutil", fake_psutil):
            snapshot = collect_system_metrics(self._unavailable_hardware_monitor())

        self.assertFalse(snapshot["cpu"]["load_average"]["available"])
        self.assertIsNone(snapshot["cpu"]["load_average"]["one_minute"])
        self.assertFalse(snapshot["cpu"]["frequencies"]["available"])
        self.assertFalse(snapshot["sensors"]["available"])

    def test_psutil_sensor_values_take_precedence_per_capability(self) -> None:
        psutil_temperature = SimpleNamespace(label="CPU", current=41, min=35, max=65, critical=95)
        fake_psutil = SimpleNamespace(
            sensors_temperatures=lambda fahrenheit=False: {"coretemp": [psutil_temperature]},
            sensors_fans=lambda: (_ for _ in ()).throw(NotImplementedError()),
            sensors_battery=lambda: None,
        )
        hardware_provider = SimpleNamespace(
            read=lambda: {
                "available": True,
                "readings": [
                    {
                        "id": "hm-temp",
                        "hardware_id": "cpu",
                        "hardware_name": "CPU",
                        "hardware_type": "cpu",
                        "name": "Package",
                        "type": "temperature",
                        "value": 55,
                        "unit": "°C",
                        "minimum": 40,
                        "maximum": 70,
                        "source": "hardware_monitor",
                    },
                    {
                        "id": "hm-power",
                        "hardware_id": "cpu",
                        "hardware_name": "CPU",
                        "hardware_type": "cpu",
                        "name": "Package Power",
                        "type": "power",
                        "value": 20,
                        "unit": "W",
                        "minimum": None,
                        "maximum": None,
                        "source": "hardware_monitor",
                    },
                ],
            }
        )

        with patch("webskin.system_metrics.psutil", fake_psutil):
            sensors = _sensors(PsutilCapabilityTracker(), hardware_provider)

        self.assertEqual(sensors["temperatures"][0]["current_c"], 41)
        self.assertEqual(sensors["readings"][0]["source"], "psutil")
        self.assertEqual(sensors["readings"][1]["type"], "power")

    def test_psutil_battery_summary_preserves_percentage_power_and_time_left(self) -> None:
        fake_psutil = SimpleNamespace(
            sensors_temperatures=lambda fahrenheit=False: {},
            sensors_fans=lambda: {},
            sensors_battery=lambda: SimpleNamespace(percent=81.5, secsleft=3600, power_plugged=False),
        )

        with patch("webskin.system_metrics.psutil", fake_psutil):
            sensors = _sensors(PsutilCapabilityTracker(), self._unavailable_hardware_monitor())

        self.assertEqual(sensors["battery"]["percent"], 81.5)
        self.assertEqual(sensors["battery"]["seconds_left"], 3600)
        self.assertFalse(sensors["battery"]["power_plugged"])

    def test_psutil_capabilities_disable_after_three_failures_independently(self) -> None:
        tracker = PsutilCapabilityTracker()
        temperature_calls = 0
        cpu_calls = 0

        def temperature_failure():
            nonlocal temperature_calls
            temperature_calls += 1
            raise NotImplementedError()

        def cpu_success():
            nonlocal cpu_calls
            cpu_calls += 1
            return [10]

        for _ in range(3):
            self.assertIs(tracker.call("temperatures", temperature_failure), _UNAVAILABLE)

        self.assertIn("temperatures", tracker.unavailable)
        self.assertIs(tracker.call("temperatures", temperature_failure), _UNAVAILABLE)
        self.assertEqual(temperature_calls, 3)
        self.assertEqual(tracker.call("cpu_utilization", cpu_success), [10])
        self.assertEqual(cpu_calls, 1)

    def test_hardware_monitor_normalizes_types_and_caches_updates(self) -> None:
        class FakeSensor:
            def __init__(self, identifier, name, sensor_type, value, minimum=None, maximum=None):
                self.Identifier = identifier
                self.Name = name
                self.SensorType = sensor_type
                self.Value = value
                self.Min = minimum
                self.Max = maximum

        class FakeHardware:
            Identifier = "cpu/0"
            Name = "CPU"
            HardwareType = "Cpu"
            SubHardware = []
            Sensors = [
                FakeSensor("cpu/temp/0", "Package", "Temperature", 47.5, 40, 80),
                FakeSensor("cpu/power/0", "Package Power", "Power", 25, None, None),
                FakeSensor("cpu/clock/0", "Core Clock", "Clock", None, None, None),
            ]

        class FakeComputer:
            Hardware = [FakeHardware()]

            def __init__(self):
                self.update_calls = 0
                self.close_calls = 0

            def Update(self):
                self.update_calls += 1

            def Close(self):
                self.close_calls += 1

        computer = FakeComputer()
        now = [10.0]
        provider = HardwareMonitorProvider(factory=lambda: computer, clock=lambda: now[0])

        first = provider.read()
        second = provider.read()
        now[0] += 1.1
        third = provider.read()
        provider.close()
        provider.close()

        self.assertEqual(computer.update_calls, 2)
        self.assertEqual(computer.close_calls, 1)
        self.assertEqual(first["readings"][0]["type"], "temperature")
        self.assertEqual(first["readings"][1]["unit"], "W")
        self.assertIsNone(first["readings"][2]["value"])
        self.assertEqual(second, first)
        self.assertEqual(third, first)

    def test_hardware_monitor_initialization_failure_is_graceful(self) -> None:
        calls = 0

        def failing_factory():
            nonlocal calls
            calls += 1
            raise OSError("driver unavailable")

        provider = HardwareMonitorProvider(factory=failing_factory)
        self.assertEqual(provider.read(), {"available": False, "readings": []})
        self.assertEqual(provider.read(), {"available": False, "readings": []})
        provider.close()
        self.assertEqual(calls, 1)

    def test_disabled_hardware_monitor_never_initializes_or_closes(self) -> None:
        calls = 0

        def factory():
            nonlocal calls
            calls += 1
            raise AssertionError("disabled HardwareMonitor must not initialize")

        provider = HardwareMonitorProvider(enabled=False, factory=factory)
        self.assertEqual(provider.read(), {"available": False, "readings": []})
        provider.close()
        self.assertEqual(calls, 0)

    def test_hardware_monitor_serializes_concurrent_refreshes(self) -> None:
        class FakeComputer:
            Hardware = []

            def __init__(self):
                self.update_calls = 0

            def Update(self):
                self.update_calls += 1

        computer = FakeComputer()
        provider = HardwareMonitorProvider(factory=lambda: computer)
        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(lambda _: provider.read(), range(8)))

        self.assertEqual(computer.update_calls, 1)
        self.assertTrue(all(result == results[0] for result in results))
        provider.close()


if __name__ == "__main__":
    unittest.main()
