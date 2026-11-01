"""Shared subscription scheduling for system metric streaming transports."""

from __future__ import annotations

import asyncio
import heapq
import itertools
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .system_metrics import SystemMetricsService


MIN_INTERVAL = 1
MAX_INTERVAL = 3600
DEFAULT_INTERVAL = 5
MAX_SUBSCRIPTIONS = 256
MAX_FIELDS = 64


@dataclass(eq=False)
class MetricsSubscription:
    manager: "MetricsSubscriptionManager"
    fields: set[str] | None
    interval: int
    sequence: int
    queue: asyncio.Queue[dict[str, Any] | None] = field(default_factory=lambda: asyncio.Queue(maxsize=1))
    closed: bool = False
    next_due: float = 0.0

    def publish(self, message: dict[str, Any]) -> None:
        if self.closed:
            return
        if self.queue.full():
            try:
                self.queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        try:
            self.queue.put_nowait(message)
        except asyncio.QueueFull:
            pass

    async def receive(self) -> dict[str, Any] | None:
        return await self.queue.get()

    def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        self.manager.remove(self)
        try:
            self.queue.put_nowait(None)
        except asyncio.QueueFull:
            try:
                self.queue.get_nowait()
                self.queue.put_nowait(None)
            except asyncio.QueueEmpty:
                pass


class MetricsSubscriptionManager:
    """One due-time scheduler shared by all active metric subscribers."""

    def __init__(self, service: "SystemMetricsService") -> None:
        self._service = service
        self._subscriptions: set[MetricsSubscription] = set()
        self._sequence = itertools.count()
        self._heap: list[tuple[float, int, MetricsSubscription]] = []
        self._task: asyncio.Task[None] | None = None
        self._wake: asyncio.Event | None = None
        self._closed = False

    @staticmethod
    def validate_interval(value: Any) -> int:
        if isinstance(value, bool) or not isinstance(value, int) or not MIN_INTERVAL <= value <= MAX_INTERVAL:
            raise ValueError(f"interval must be an integer from {MIN_INTERVAL} through {MAX_INTERVAL}")
        return value

    @staticmethod
    def validate_fields(fields: set[str] | None, supported_fields: set[str]) -> set[str] | None:
        if fields is None:
            return None
        if not fields or len(fields) > MAX_FIELDS:
            raise ValueError(f"fields must contain between 1 and {MAX_FIELDS} supported metric fields")
        invalid = sorted(fields - supported_fields)
        if invalid:
            raise ValueError(f"Unsupported system metric field: {invalid[0]}")
        return set(fields)

    async def subscribe(self, fields: set[str] | None, interval: int) -> MetricsSubscription:
        if self._closed:
            raise RuntimeError("metric subscriptions are closed")
        if len(self._subscriptions) >= MAX_SUBSCRIPTIONS:
            raise RuntimeError("metric subscription limit reached")
        interval = self.validate_interval(interval)
        subscription = MetricsSubscription(
            manager=self,
            fields=None if fields is None else set(fields),
            interval=interval,
            sequence=next(self._sequence),
            next_due=asyncio.get_running_loop().time(),
        )
        self._subscriptions.add(subscription)
        heapq.heappush(self._heap, (subscription.next_due, subscription.sequence, subscription))
        self._ensure_task()
        self._notify()
        return subscription

    def remove(self, subscription: MetricsSubscription) -> None:
        self._subscriptions.discard(subscription)
        self._notify()

    def _ensure_task(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._wake = asyncio.Event()
        self._task = asyncio.create_task(self._run(), name="webskin-metric-subscriptions")

    def _notify(self) -> None:
        if self._wake is not None:
            self._wake.set()

    async def _wait(self, delay: float) -> None:
        if self._wake is None:
            await asyncio.sleep(delay)
            return
        self._wake.clear()
        try:
            await asyncio.wait_for(self._wake.wait(), timeout=max(0.0, delay))
        except asyncio.TimeoutError:
            pass

    async def _run(self) -> None:
        try:
            while self._subscriptions and not self._closed:
                now = asyncio.get_running_loop().time()
                while self._heap and (
                    self._heap[0][2].closed
                    or self._heap[0][2] not in self._subscriptions
                    or self._heap[0][0] != self._heap[0][2].next_due
                ):
                    heapq.heappop(self._heap)
                if not self._heap:
                    await self._wait(1.0)
                    continue
                await self._wait(self._heap[0][0] - now)
                now = asyncio.get_running_loop().time()
                due: list[MetricsSubscription] = []
                while self._heap and self._heap[0][0] <= now:
                    _, _, subscription = heapq.heappop(self._heap)
                    if subscription.closed or subscription not in self._subscriptions:
                        continue
                    subscription.next_due = now + subscription.interval
                    heapq.heappush(self._heap, (subscription.next_due, subscription.sequence, subscription))
                    due.append(subscription)
                if not due:
                    continue
                fields: set[str] | None = set()
                if any(subscription.fields is None for subscription in due):
                    fields = None
                else:
                    for subscription in due:
                        fields.update(subscription.fields or set())
                try:
                    snapshot = await self._service.collect_async(fields)
                except Exception:
                    for subscription in due:
                        subscription.publish({
                            "type": "error",
                            "code": "collection_failed",
                            "message": "System metric collection failed",
                        })
                    continue
                for subscription in due:
                    subscription.publish({
                        "type": "snapshot",
                        "data": self._service.project_snapshot(snapshot, subscription.fields),
                    })
        except asyncio.CancelledError:
            raise
        finally:
            if self._task is asyncio.current_task():
                self._task = None

    def close(self) -> None:
        self._closed = True
        for subscription in list(self._subscriptions):
            subscription.close()
        if self._task is not None:
            self._task.cancel()
            self._task = None
        self._subscriptions.clear()
        self._heap.clear()
        self._notify()
