import { Widget } from "../../widgets.js";

const DEFAULT_UPDATE_INTERVAL = 60;
const STYLE_ID = "webskin-timer-plain-styles";
const TIME_ENDPOINT = "/api/system/time";

const timerHost = () => (typeof window === "undefined" ? globalThis : window);

const ensureStyles = () => {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return;
  if (typeof document.getElementById === "function" && document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-timer {
      box-sizing: border-box;
      display: inline-block;
      width: var(--webskin-timer-width, 8ch);
      height: var(--webskin-timer-height, 1.5em);
      min-width: 0;
      min-height: 0;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
  `;
  document.head?.append(style);
};

const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;

const validateDuration = (value, label) => {
  if (!isNonNegativeInteger(value)) {
    throw new RangeError(`${label} must be a non-negative integer number of milliseconds`);
  }
  return value;
};

const validateUpdateInterval = (value) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError("updateInterval must be a positive integer number of seconds");
  }
  return value;
};

const formatDuration = (milliseconds) => {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
};

const requestSystemTime = async (endpoint) => {
  const request = globalThis.fetch ?? timerHost().fetch;
  if (typeof request !== "function") throw new TypeError("Timers require fetch to query system time");
  const response = await request(endpoint);
  if (!response?.ok) throw new Error(`System time query failed: ${response?.status ?? "unknown status"}`);
  const value = await response.json();
  if (!Number.isFinite(value?.epochMilliseconds)) {
    throw new TypeError("System time response must contain epochMilliseconds");
  }
  return value.epochMilliseconds;
};

export class PlainTimer extends Widget {
  constructor({ kind, time = 0, limit, updateInterval = DEFAULT_UPDATE_INTERVAL, endpoint = TIME_ENDPOINT, className = "" }) {
    ensureStyles();
    if (kind !== "countdown" && kind !== "stopwatch") throw new TypeError("Unknown timer type");
    if (kind === "countdown") validateDuration(time, "time");
    if (kind === "stopwatch" && limit !== undefined && limit !== null) validateDuration(limit, "limit");
    validateUpdateInterval(updateInterval);

    const element = document.createElement("time");
    super(element, { type: "timer" });
    element.className = ["webskin-timer", `webskin-timer--${kind}`, className]
      .filter(Boolean)
      .join(" ");
    element.dataset.webskinTimerType = kind;
    element.setAttribute("aria-label", kind === "countdown" ? "Countdown timer" : "Stopwatch");

    let current = kind === "countdown" ? time : 0;
    const initial = kind === "countdown" ? time : 0;
    let timerLimit = limit ?? null;
    let interval = updateInterval;
    let active = false;
    let completed = false;
    let state = "paused";
    let anchorValue = current;
    let anchorTime = Date.now();
    let clockOffset = 0;
    let renderTimer;
    let syncTimer;
    let runId = 0;
    let destroyed = false;

    const render = () => {
      element.textContent = formatDuration(current);
      element.dataset.webskinTimerState = state;
      element.dataset.webskinTimerMilliseconds = String(Math.max(0, Math.floor(current)));
    };

    const clearTimer = (name) => {
      if (name === "render" && renderTimer !== undefined) {
        timerHost().clearTimeout(renderTimer);
        renderTimer = undefined;
      }
      if (name === "sync" && syncTimer !== undefined) {
        timerHost().clearTimeout(syncTimer);
        syncTimer = undefined;
      }
    };

    const clearActiveTimers = () => {
      clearTimer("render");
      clearTimer("sync");
    };

    const logicalNow = () => Date.now() + clockOffset;

    const stopAtLimit = () => {
      const token = runId;
      current = timerLimit;
      active = false;
      completed = true;
      state = "finished";
      runId += 1;
      clearActiveTimers();
      render();
      void querySystemTime(token, false);
    };

    const updateCurrent = (now = logicalNow()) => {
      if (!active) return current;
      const elapsed = Math.max(0, now - anchorTime);
      current = kind === "countdown"
        ? Math.max(0, anchorValue - elapsed)
        : anchorValue + elapsed;

      if (kind === "countdown" && current <= 0) {
        const token = runId;
        current = 0;
        active = false;
        completed = true;
        state = "finished";
        runId += 1;
        clearActiveTimers();
        void querySystemTime(token, false);
      } else if (kind === "stopwatch" && timerLimit !== null && current >= timerLimit) {
        stopAtLimit();
      }
      render();
      return current;
    };

    const scheduleRender = () => {
      if (!active || destroyed) return;
      const delay = Math.max(1, 1000 - (Date.now() % 1000));
      renderTimer = timerHost().setTimeout(() => {
        renderTimer = undefined;
        updateCurrent();
        if (active) scheduleRender();
      }, delay);
    };

    const scheduleSync = (token) => {
      if (!active || destroyed || token !== runId) return;
      clearTimer("sync");
      syncTimer = timerHost().setTimeout(() => {
        syncTimer = undefined;
        void querySystemTime(token, true);
      }, interval * 1000);
    };

    const querySystemTime = async (token, apply) => {
      try {
        const systemTime = await requestSystemTime(endpoint);
        if (!apply || !active || destroyed || token !== runId) return;
        updateCurrent();
        clockOffset = systemTime - Date.now();
        anchorTime = systemTime;
        anchorValue = current;
        render();
        scheduleSync(token);
      } catch {
        if (apply && active && !destroyed && token === runId) scheduleSync(token);
      }
    };

    const endRun = (nextState) => {
      if (!active) return;
      updateCurrent();
      if (!active) return;
      const token = runId;
      active = false;
      state = nextState;
      runId += 1;
      clearActiveTimers();
      render();
      void querySystemTime(token, false);
    };

    const start = () => {
      if (destroyed || active || completed) return element;
      if (kind === "countdown" && current <= 0) return element;
      if (kind === "stopwatch" && timerLimit === 0) {
        completed = true;
        state = "finished";
        render();
        return element;
      }
      active = true;
      state = "running";
      anchorValue = current;
      anchorTime = logicalNow();
      const token = ++runId;
      render();
      scheduleRender();
      scheduleSync(token);
      void querySystemTime(token, true);
      return element;
    };

    const pause = () => {
      if (destroyed || !active) return element;
      endRun("paused");
      return element;
    };

    const resume = () => start();

    const restart = () => {
      if (destroyed) return element;
      if (active) endRun("paused");
      current = initial;
      completed = false;
      state = "paused";
      anchorValue = current;
      anchorTime = logicalNow();
      render();
      return element;
    };

    const setTime = (value) => {
      if (destroyed) return element;
      if (kind !== "countdown") return element;
      validateDuration(value, "time");
      if (active) endRun("paused");
      current = value;
      anchorValue = value;
      completed = false;
      state = "paused";
      render();
      return element;
    };

    const setLimit = (value) => {
      if (destroyed) return element;
      if (kind !== "stopwatch") return element;
      if (value !== null) validateDuration(value, "limit");
      if (active) updateCurrent();
      timerLimit = value;
      if (timerLimit !== null && current >= timerLimit) {
        current = timerLimit;
        if (active) endRun("finished");
        else {
          completed = true;
          state = "finished";
        }
      }
      render();
      return element;
    };

    const setUpdateInterval = (value) => {
      if (destroyed) return element;
      validateUpdateInterval(value);
      interval = value;
      if (active) {
        clearTimer("sync");
        scheduleSync(runId);
      }
      return element;
    };

    Object.defineProperties(element, {
      start: { configurable: true, value: start },
      pause: { configurable: true, value: pause },
      resume: { configurable: true, value: resume },
      restart: { configurable: true, value: restart },
      setTime: { configurable: true, value: setTime },
      setLimit: { configurable: true, value: setLimit },
      setUpdateInterval: { configurable: true, value: setUpdateInterval },
    });

    render();
    this.addCleanup(() => {
      destroyed = true;
      active = false;
      runId += 1;
      clearActiveTimers();
    });
  }
}

export { DEFAULT_UPDATE_INTERVAL, formatDuration, validateDuration, validateUpdateInterval };
