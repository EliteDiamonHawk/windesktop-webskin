import assert from "node:assert/strict";
import test from "node:test";

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.className = "";
    this.id = "";
    this.textContent = "";
    this.attributes = {};
  }

  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
}

let now = 0;
let nextTimer = 1;
let timers = new Map();
let timerDelays = [];
let requests = 0;
let requestFails = false;

const installDom = () => {
  now = 0;
  nextTimer = 1;
  timers = new Map();
  timerDelays = [];
  requests = 0;
  requestFails = false;
  const head = new FakeElement("head");
  globalThis.document = {
    head,
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: (id) => head.children.find((child) => child.id === id) ?? null,
  };
  globalThis.window = {
    setTimeout: (callback, delay) => {
      const id = nextTimer++;
      timers.set(id, callback);
      timerDelays.push(delay);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  globalThis.fetch = async () => {
    requests += 1;
    if (requestFails) throw new Error("offline");
    return { ok: true, json: async () => ({ epochMilliseconds: 1_000_000 + now }) };
  };
  Date.now = () => now;
};

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const runNextTimer = () => {
  const entry = timers.entries().next().value;
  assert.ok(entry, "expected a scheduled timer");
  timers.delete(entry[0]);
  entry[1]();
};

let originalDateNow;
let countdown;
let stopwatch;

test.before(async () => {
  originalDateNow = Date.now;
  installDom();
  countdown = (await import("../src/widgets/time/timers/countdown.js?timer-test")).createCountdown;
  stopwatch = (await import("../src/widgets/time/timers/stopwatch.js?timer-test")).createStopwatch;
});

test.after(() => {
  Date.now = originalDateNow;
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.fetch;
});

test("countdown starts paused and exposes controls", async () => {
  installDom();
  const timer = countdown({ time: 10_000, updateInterval: 5 });
  assert.equal(timer.textContent, "00:00:10");
  assert.equal(timer.dataset.webskinTimerState, "paused");
  assert.equal(requests, 0);

  timer.start();
  await flush();
  assert.equal(requests, 1);
  assert.equal(timer.dataset.webskinTimerState, "running");

  now = 2_500;
  runNextTimer();
  assert.equal(timer.textContent, "00:00:07");

  timer.pause();
  await flush();
  assert.equal(timer.dataset.webskinTimerState, "paused");
  assert.equal(requests, 2);

  timer.setTime(3_000);
  assert.equal(timer.textContent, "00:00:03");
  timer.restart();
  assert.equal(timer.textContent, "00:00:10");
  assert.equal(timer.dataset.webskinTimerState, "paused");
  timer.destroy();
});

test("countdown finishes at zero and queries system time at end", async () => {
  installDom();
  const timer = countdown({ time: 2_000 });
  timer.start();
  await flush();
  now = 2_000;
  runNextTimer();
  await flush();

  assert.equal(timer.textContent, "00:00:00");
  assert.equal(timer.dataset.webskinTimerState, "finished");
  assert.equal(requests, 2);
  timer.resume();
  assert.equal(requests, 2);
  timer.destroy();
});

test("stopwatch clamps at limit and requires restart", async () => {
  installDom();
  const timer = stopwatch({ limit: 3_000 });
  assert.equal(timer.textContent, "00:00:00");
  timer.start();
  await flush();
  now = 3_000;
  runNextTimer();
  await flush();

  assert.equal(timer.textContent, "00:00:03");
  assert.equal(timer.dataset.webskinTimerState, "finished");
  const requestsAtLimit = requests;
  timer.resume();
  assert.equal(requests, requestsAtLimit);
  timer.restart();
  assert.equal(timer.textContent, "00:00:00");
  assert.equal(timer.dataset.webskinTimerState, "paused");
  timer.setLimit(null);
  timer.start();
  await flush();
  assert.equal(timer.dataset.webskinTimerState, "running");
  timer.destroy();
});

test("sync interval can change while running and failed sync uses browser time", async () => {
  installDom();
  const timer = stopwatch({ updateInterval: 9 });
  timer.start();
  await flush();
  assert.ok(timerDelays.includes(9_000));
  timer.setUpdateInterval(2);
  assert.ok(timerDelays.includes(2_000));
  timer.destroy();

  installDom();
  requestFails = true;
  const fallback = stopwatch();
  fallback.start();
  await flush();
  now = 1_500;
  runNextTimer();
  assert.equal(fallback.textContent, "00:00:01");
  fallback.destroy();
});

test("invalid timer values are rejected", () => {
  installDom();
  assert.throws(() => countdown(), TypeError);
  assert.throws(() => countdown({ time: -1 }), RangeError);
  assert.throws(() => stopwatch({ limit: 1.5 }), RangeError);
  assert.throws(() => stopwatch({ updateInterval: 0 }), RangeError);
  const timer = stopwatch();
  assert.throws(() => timer.setLimit(-1), RangeError);
  assert.throws(() => timer.setUpdateInterval(1.5), RangeError);
  timer.destroy();
});
