import assert from "node:assert/strict";
import test from "node:test";

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.className = "";
    this.style = {
      values: new Map(),
      setProperty: (name, value) => this.style.values.set(name, String(value)),
      getPropertyValue: (name) => this.style.values.get(name) ?? "",
    };
    this.id = "";
    this.textContent = "";
    this.attributes = {};
    this.listeners = new Map();
  }

  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  removeEventListener(name, listener) {
    if (this.listeners.get(name) === listener) this.listeners.delete(name);
  }
  click() { return this.listeners.get("click")?.(); }
  matches(selector) {
    const match = selector.match(/^\[data-webskin-timer-(part|control)(?:="([^"]+)")?\]$/);
    if (!match) return false;
    const value = this.dataset[`webskinTimer${match[1] === "part" ? "Part" : "Control"}`];
    return match[2] === undefined ? value !== undefined : value === match[2];
  }
  querySelectorAll(selector) {
    const matches = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (!(child instanceof FakeElement)) continue;
        if (child.matches(selector)) matches.push(child);
        visit(child);
      }
    };
    visit(this);
    return matches;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

let now = 0;
let nextTimer = 1;
let timers = new Map();
let timerDelays = [];
let requests = 0;
let requestFails = false;
let invalidTimeResponse = false;

const installDom = () => {
  now = 0;
  nextTimer = 1;
  timers = new Map();
  timerDelays = [];
  requests = 0;
  requestFails = false;
  invalidTimeResponse = false;
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
    if (invalidTimeResponse) return { ok: true, json: async () => ({ epochMilliseconds: "invalid" }) };
    return { ok: true, json: async () => ({ epochMilliseconds: 1_000_000 + now }) };
  };
  Date.now = () => now;
};

const flush = async () => {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
};

const runNextTimer = () => {
  const entry = timers.entries().next().value;
  assert.ok(entry, "expected a scheduled timer");
  timers.delete(entry[0]);
  entry[1]();
};

const displayOf = (timer) => timer.querySelector('[data-webskin-timer-part="display"]').textContent;

let originalDateNow;
let countdown;
let stopwatch;
let styledCountdown;
let styledStopwatch;
let timerTimeManager;

test.before(async () => {
  originalDateNow = Date.now;
  installDom();
  countdown = (await import("../src/widgets/time/timers/countdown-plain.js?timer-test")).createCountdown;
  stopwatch = (await import("../src/widgets/time/timers/stopwatch-plain.js?timer-test")).createStopwatch;
  styledCountdown = (await import("../src/widgets/time/timers/countdown-prestyled.js?timer-test")).createCountdown;
  styledStopwatch = (await import("../src/widgets/time/timers/stopwatch-prestyled.js?timer-test")).createStopwatch;
  timerTimeManager = (await import("../src/widgets/time/timers/timers.js?timer-test")).timerTimeManager;
});

test.after(() => {
  Date.now = originalDateNow;
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.fetch;
});

test("timers hide controls by default", () => {
  installDom();
  const timer = countdown({ time: 10_000 });
  assert.equal(timer.querySelectorAll("[data-webskin-timer-control]").length, 0);
  timer.destroy();
});

test("pre-styled timers use assets and state-based controls", () => {
  installDom();
  const timer = styledCountdown({ time: 10_000 });
  assert.equal(timer.parts.value.textContent, "00:00:10");
  assert.equal(timer.parts.subtext.textContent, "Countdown");
  assert.deepEqual(timer.parts.actions.children.map((button) => button.textContent), ["Play", "Restart"]);
  assert.equal(
    timer.parts.icon.children[0].style.getPropertyValue("mask-image"),
    'url("/assets/icons/hourglass-half-svgrepo-com.svg")',
  );
  assert.equal(
    timer.parts.iconFrame.children[0].style.getPropertyValue("mask-image"),
    'url("/assets/shapes/soft-burst.svg")',
  );

  timer.parts.actions.children[0].click();
  assert.deepEqual(timer.parts.actions.children.map((button) => button.textContent), ["Pause", "Restart"]);
  timer.parts.actions.children[0].click();
  assert.deepEqual(timer.parts.actions.children.map((button) => button.textContent), ["Resume", "Restart"]);
  timer.destroy();

  const stopwatchTimer = styledStopwatch({ buttons: false });
  assert.equal(stopwatchTimer.parts.actions.children.length, 0);
  assert.equal("setTime" in stopwatchTimer, false);
  assert.equal("setLimit" in timer, false);
  stopwatchTimer.destroy();
});

test("timers support clock-style duration syntax", () => {
  installDom();
  const countdownTimer = countdown({ time: 90_000, syntax: "m minute, ss second" });
  assert.equal(displayOf(countdownTimer), "1 minute, 30 second");
  countdownTimer.destroy();

  const stopwatchTimer = stopwatch({ syntax: "H:mm:ss" });
  assert.equal(displayOf(stopwatchTimer), "0:00:00");
  stopwatchTimer.destroy();
});

test("timer syntax uses total elapsed hours and forwards through pre-styled timers", () => {
  installDom();
  const countdownTimer = countdown({ time: 90_000_000 });
  assert.equal(displayOf(countdownTimer), "25:00:00");
  countdownTimer.destroy();

  const styledTimer = styledCountdown({ time: 90_000, syntax: "m:ss remaining" });
  assert.equal(styledTimer.parts.value.textContent, "1:30 remaining");
  styledTimer.destroy();
});

test("countdown exposes controls when requested", async () => {
  installDom();
  const timer = countdown({ time: 10_000, updateInterval: 5, buttons: true });
  assert.equal(displayOf(timer), "00:00:10");
  const controls = () => timer.querySelectorAll("[data-webskin-timer-control]");
  assert.deepEqual(controls().map((button) => button.textContent), ["Play", "Restart", "Resume", "Pause"]);
  assert.equal(timer.dataset.webskinTimerState, "paused");
  assert.equal(requests, 0);

  controls()[0].click();
  await flush();
  assert.equal(requests, 1);
  assert.equal(timer.dataset.webskinTimerState, "running");

  now = 2_500;
  runNextTimer();
  assert.equal(displayOf(timer), "00:00:07");

  controls()[3].click();
  await flush();
  assert.equal(timer.dataset.webskinTimerState, "paused");
  assert.equal(requests, 1);

  timer.setTime(3_000);
  assert.equal(displayOf(timer), "00:00:03");
  controls()[1].click();
  assert.equal(displayOf(timer), "00:00:10");
  assert.equal(timer.dataset.webskinTimerState, "paused");
  controls()[2].click();
  controls()[3].click();
  timer.destroy();
});

test("countdown finishes at zero and unsubscribes at end", async () => {
  installDom();
  const timer = countdown({ time: 2_000 });
  timer.start();
  await flush();
  now = 2_000;
  runNextTimer();
  await flush();

  assert.equal(displayOf(timer), "00:00:00");
  assert.equal(timer.dataset.webskinTimerState, "finished");
  assert.equal(requests, 1);
  timer.resume();
  assert.equal(requests, 1);
  timer.destroy();
});

test("stopwatch clamps at limit and requires restart", async () => {
  installDom();
  const timer = stopwatch({ limit: 3_000 });
  assert.equal(displayOf(timer), "00:00:00");
  timer.start();
  await flush();
  now = 3_000;
  runNextTimer();
  await flush();

  assert.equal(displayOf(timer), "00:00:03");
  assert.equal(timer.dataset.webskinTimerState, "finished");
  const requestsAtLimit = requests;
  timer.resume();
  assert.equal(requests, requestsAtLimit);
  timer.restart();
  assert.equal(displayOf(timer), "00:00:00");
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
  await flush();
  assert.ok(timerDelays.includes(2_000));
  timer.destroy();

  installDom();
  requestFails = true;
  const fallback = stopwatch();
  fallback.start();
  await flush();
  now = 1_500;
  runNextTimer();
  assert.equal(displayOf(fallback), "00:00:01");
  fallback.destroy();
});

test("active timers share backend time requests", async () => {
  installDom();
  const first = countdown({ time: 10_000, updateInterval: 3 });
  const second = stopwatch({ updateInterval: 3 });
  first.start();
  second.start();
  await flush();
  assert.equal(requests, 1);
  first.destroy();
  second.destroy();
  assert.equal(timers.size, 0);
});

test("timer time subscription reports invalid responses", async () => {
  installDom();
  invalidTimeResponse = true;
  let errors = 0;
  const unsubscribe = timerTimeManager.subscribe({
    updateInterval: 4,
    onError: () => { errors += 1; },
  });
  await flush();
  assert.equal(errors, 1);
  unsubscribe();
  assert.equal(timers.size, 0);
});

test("invalid timer values are rejected", () => {
  installDom();
  assert.throws(() => countdown(), TypeError);
  assert.throws(() => countdown({ time: -1 }), RangeError);
  assert.throws(() => countdown({ time: 1_000, updateInterval: 0 }), RangeError);
  assert.throws(() => stopwatch({ limit: 1.5 }), RangeError);
  assert.throws(() => stopwatch({ updateInterval: 0 }), RangeError);
  assert.throws(() => stopwatch({ interval: 1000 }), TypeError);
  const timer = stopwatch();
  assert.throws(() => timer.setLimit(-1), RangeError);
  assert.throws(() => timer.setUpdateInterval(1.5), RangeError);
  const unsupportedCountdown = countdown({ time: 1000 });
  assert.equal("setLimit" in unsupportedCountdown, false);
  assert.equal("setTime" in timer, false);
  unsupportedCountdown.destroy();
  timer.destroy();
});
