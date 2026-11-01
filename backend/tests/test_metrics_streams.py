from __future__ import annotations

import asyncio
import unittest

from webskin.metrics_streams import MetricsSubscriptionManager


class FakeMetricsService:
    def __init__(self) -> None:
        self.calls: list[set[str] | None] = []

    async def collect_async(self, fields):
        self.calls.append(None if fields is None else set(fields))
        await asyncio.sleep(0)
        return {"timestamp": "test", "fields": fields}

    def project_snapshot(self, snapshot, fields):
        return {**snapshot, "fields": fields}


class MetricsStreamTests(unittest.TestCase):
    def test_scheduler_delivers_initial_snapshot_and_stops_after_disconnect(self) -> None:
        async def exercise() -> None:
            service = FakeMetricsService()
            manager = MetricsSubscriptionManager(service)
            subscription = await manager.subscribe({"cpu.utilization.overall"}, 1)

            message = await asyncio.wait_for(subscription.receive(), timeout=1)
            self.assertEqual(message["type"], "snapshot")
            self.assertEqual(service.calls, [{"cpu.utilization.overall"}])

            subscription.close()
            await asyncio.sleep(0)
            self.assertFalse(manager._subscriptions)
            manager.close()

        asyncio.run(exercise())

    def test_subscription_mailbox_keeps_latest_snapshot_only(self) -> None:
        async def exercise() -> None:
            manager = MetricsSubscriptionManager(FakeMetricsService())
            subscription = await manager.subscribe({"memory.virtual.percent"}, 1)
            await asyncio.wait_for(subscription.receive(), timeout=1)
            subscription.publish({"type": "snapshot", "sequence": 1})
            subscription.publish({"type": "snapshot", "sequence": 2})
            self.assertEqual((await subscription.receive())["sequence"], 2)
            manager.close()

        asyncio.run(exercise())

    def test_interval_validation_rejects_unbounded_sampling(self) -> None:
        with self.assertRaises(ValueError):
            MetricsSubscriptionManager.validate_interval(0)
        with self.assertRaises(ValueError):
            MetricsSubscriptionManager.validate_interval(3601)


if __name__ == "__main__":
    unittest.main()
