import assert from "node:assert/strict";
import test from "node:test";

let now = 0;
let nextTimer = 1;
let timeoutCallbacks = new Map();
let clearedTimers = [];
let animationCallbacks = new Map();
let nextAnimationFrame = 1;
let cancelledFrames = [];
let fetchCalls = [];

const installWindow = () => {
  now = 0;
  nextTimer = 1;
  timeoutCallbacks = new Map();
  clearedTimers = [];
  animationCallbacks = new Map();
  nextAnimationFrame = 1;
  cancelledFrames = [];
  fetchCalls = [];
  globalThis.window = {
    setTimeout: (callback) => {
      const id = nextTimer++;
      timeoutCallbacks.set(id, callback);
      return id;
    },
    clearTimeout: (id) => {
      clearedTimers.push(id);
      timeoutCallbacks.delete(id);
    },
    requestAnimationFrame: (callback) => {
      const id = nextAnimationFrame++;
      animationCallbacks.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => {
      cancelledFrames.push(id);
      animationCallbacks.delete(id);
    },
    fetch: async (url) => {
      fetchCalls.push(String(url));
      if (url.endsWith("/api/settings/widgets/time-intervals")) {
        return {
          ok: true,
          json: async () => ({
            clock: 7,
            calendar: 11,
            widgets: {
              "clock-digital-plain": 2,
              "clock-analog-plain": 9,
              "day-plain": 13,
            },
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    },
  };
  Date.now = () => now;
};

let scheduler;
let originalDateNow;
test.before(async () => {
  originalDateNow = Date.now;
  installWindow();
  scheduler = await import("../src/widgets/time/time-scheduler.js?scheduler-test");
});

test.after(() => {
  Date.now = originalDateNow;
  delete globalThis.window;
});

test.afterEach(() => {
  for (const callback of [...timeoutCallbacks.values()]) callback();
  timeoutCallbacks.clear();
});

const advance = (milliseconds) => {
  now += milliseconds;
  const callbacks = [...timeoutCallbacks.entries()];
  timeoutCallbacks.clear();
  callbacks.forEach(([, callback]) => callback());
};

test("clock subscribers share one timer and retain independent intervals", async () => {
  const updates = [];
  const first = scheduler.subscribeClock(() => updates.push("first"), 1);
  const second = scheduler.subscribeClock(() => updates.push("second"), 5);

  assert.equal(timeoutCallbacks.size, 1);
  advance(1000);
  assert.deepEqual(updates, ["first"]);
  advance(4000);
  assert.deepEqual(updates, ["first", "first", "second"]);

  first();
  second();
  assert.ok(clearedTimers.length > 0);
});

test("app defaults are fetched once and widget intervals do not fetch settings", async () => {
  const explicit = scheduler.subscribeClock(() => {}, 2);
  explicit();
  const first = scheduler.subscribeClock(() => {});
  await Promise.resolve();
  const second = scheduler.subscribeClock(() => {});
  await Promise.resolve();

  assert.equal(fetchCalls.filter((url) => url.endsWith("/api/settings/widgets/time-intervals")).length, 1);
  first();
  second();
});

test("backend-resolved defaults apply once and explicit widget options skip the request", async () => {
  const updates = [];
  const cleanup = scheduler.subscribeClock(() => updates.push("resolved"));
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  advance(7000);
  assert.deepEqual(updates, ["resolved"]);
  assert.equal(fetchCalls.filter((url) => url.endsWith("/api/settings/widgets/time-intervals")).length, 1);
  cleanup();

  const explicit = scheduler.subscribeClock(() => {}, { updateInterval: 2 });
  explicit();
  assert.equal(fetchCalls.filter((url) => url.endsWith("/api/settings/widgets/time-intervals")).length, 1);
});

test("common widget settings resolve independently within a family", async () => {
  const updates = [];
  const digital = scheduler.subscribeClock(() => updates.push("digital"), {
    widgetId: "clock-digital-plain",
  });
  const analog = scheduler.subscribeClock(() => updates.push("analog"), {
    widgetId: "clock-analog-plain",
  });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  advance(2000);
  assert.equal(updates.filter((value) => value === "digital").length, 1);
  assert.equal(updates.filter((value) => value === "analog").length, 0);
  advance(7000);
  assert.equal(updates.filter((value) => value === "digital").length, 2);
  assert.equal(updates.filter((value) => value === "analog").length, 1);

  digital();
  analog();
});

test("calendar subscriptions are independent from clock subscriptions", () => {
  const updates = [];
  const clock = scheduler.subscribeClock(() => updates.push("clock"), 2);
  const calendar = scheduler.subscribeCalendar(() => updates.push("calendar"), 11);

  assert.equal(timeoutCallbacks.size, 2);
  advance(2000);
  assert.deepEqual(updates, ["clock"]);

  clock();
  calendar();
});

test("smooth subscribers share one animation frame and stop on cleanup", () => {
  const updates = [];
  const first = scheduler.subscribeAnimation(() => updates.push("first"));
  const second = scheduler.subscribeAnimation(() => updates.push("second"));

  assert.equal(animationCallbacks.size, 1);
  const [frameId, frame] = animationCallbacks.entries().next().value;
  animationCallbacks.delete(frameId);
  frame(0);
  assert.deepEqual(updates, ["first", "second"]);
  assert.equal(animationCallbacks.size, 1);

  first();
  assert.equal(cancelledFrames.length, 0);
  second();
  assert.equal(cancelledFrames.length, 1);
});

test("invalid widget intervals are rejected", () => {
  assert.throws(() => scheduler.subscribeClock(() => {}, 0), RangeError);
  assert.throws(() => scheduler.subscribeCalendar(() => {}, 1.5), RangeError);
});
