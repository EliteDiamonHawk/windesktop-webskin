from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from webskin.routes import create_system_router
from webskin.system_metrics import collect_system_metrics


class SystemMetricsTests(unittest.TestCase):
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
            snapshot = collect_system_metrics()

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
            snapshot = collect_system_metrics()

        self.assertFalse(snapshot["cpu"]["load_average"]["available"])
        self.assertIsNone(snapshot["cpu"]["load_average"]["one_minute"])
        self.assertFalse(snapshot["cpu"]["frequencies"]["available"])
        self.assertFalse(snapshot["sensors"]["available"])


if __name__ == "__main__":
    unittest.main()
