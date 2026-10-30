import { Widget } from "../../widgets.js";
import { timerTimeManager } from "./timers.js";
import { formatDuration } from "./timer-format.js";

export { formatDuration } from "./timer-format.js";

const DEFAULT_UPDATE_INTERVAL = 60;
const TIME_ENDPOINT = "/api/system/time";
const STYLE_ID = "webskin-timer-plain-styles";

const timerHost = () => (typeof window === "undefined" ? globalThis : window);
const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;

export const validateDuration = (value, label) => {
  if (!isNonNegativeInteger(value)) {
    throw new RangeError(`${label} must be a non-negative integer number of milliseconds`);
  }
  return value;
};

export const validateUpdateInterval = (value) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError("updateInterval must be a positive integer number of seconds");
  }
  return value;
};

const ensureStyles = () => {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return;
  if (document.getElementById?.(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-timer {
      box-sizing: border-box;
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      gap: .5rem;
      width: var(--webskin-timer-width, max-content);
      height: var(--webskin-timer-height, auto);
      min-width: 0;
      min-height: 0;
    }
    .webskin-timer__display {
      display: block;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .webskin-timer__controls {
      display: inline-flex;
      flex-wrap: nowrap;
      width: max-content;
      gap: .5rem;
    }
  `;
  document.head?.append(style);
};

export function createStopwatch(options = {}) {
  ensureStyles();
  if (options.limit !== undefined && options.limit !== null) validateDuration(options.limit, "limit");
  let interval = options.updateInterval ?? DEFAULT_UPDATE_INTERVAL;
  validateUpdateInterval(interval);
  const syntax = options.syntax;

  const element = document.createElement("section");
  const display = document.createElement("time");
  const widget = new Widget(element, { type: "timer" });
  element.className = ["webskin-timer", "webskin-timer--stopwatch", options.className].filter(Boolean).join(" ");
  element.dataset.webskinTimerType = "stopwatch";
  element.dataset.webskinTimerStarted = "false";
  element.setAttribute("aria-live", "polite");
  display.className = "webskin-timer__display";
  display.dataset.webskinTimerPart = "display";
  display.setAttribute("aria-label", "Stopwatch timer");

  let current = 0;
  let timerLimit = options.limit ?? null;
  let active = false;
  let completed = false;
  let state = "paused";
  let anchorValue = 0;
  let anchorTime = Date.now();
  let clockOffset = 0;
  let renderTimer;
  let unsubscribeTime;
  let destroyed = false;
  let controls;

  const logicalNow = () => Date.now() + clockOffset;
  const clearRenderTimer = () => {
    if (renderTimer !== undefined) timerHost().clearTimeout(renderTimer);
    renderTimer = undefined;
  };
  const stopSubscription = () => {
    unsubscribeTime?.();
    unsubscribeTime = undefined;
  };
  const render = () => {
    display.textContent = formatDuration(current, syntax);
    element.dataset.webskinTimerState = state;
    element.dataset.webskinTimerMilliseconds = String(Math.max(0, Math.floor(current)));
  };
  const finish = () => {
    current = timerLimit ?? current;
    active = false;
    completed = true;
    state = "finished";
    clearRenderTimer();
    stopSubscription();
    render();
  };
  const updateCurrent = (now = logicalNow()) => {
    if (!active) return current;
    current = anchorValue + Math.max(0, now - anchorTime);
    if (timerLimit !== null && current >= timerLimit) finish();
    else render();
    return current;
  };
  const scheduleRender = () => {
    if (!active || destroyed) return;
    renderTimer = timerHost().setTimeout(() => {
      renderTimer = undefined;
      updateCurrent();
      if (active) scheduleRender();
    }, Math.max(1, 1000 - (Date.now() % 1000)));
  };
  const subscribeTime = (seconds = interval) => {
    stopSubscription();
    unsubscribeTime = timerTimeManager.subscribe({
      endpoint: options.endpoint ?? TIME_ENDPOINT,
      interval: seconds,
      onTime: (systemTime) => {
        if (!active || destroyed) return;
        updateCurrent();
        clockOffset = systemTime - Date.now();
        anchorTime = systemTime;
        anchorValue = current;
        render();
        scheduleRender();
      },
    });
  };
  const start = () => {
    if (destroyed || active || completed) return element;
    if (timerLimit === 0) {
      completed = true;
      state = "finished";
      render();
      return element;
    }
    active = true;
    state = "running";
    element.dataset.webskinTimerStarted = "true";
    anchorValue = current;
    anchorTime = logicalNow();
    render();
    scheduleRender();
    subscribeTime();
    return element;
  };
  const pause = () => {
    if (destroyed || !active) return element;
    updateCurrent();
    if (!active) return element;
    active = false;
    state = "paused";
    clearRenderTimer();
    stopSubscription();
    render();
    return element;
  };
  const resume = () => start();
  const restart = () => {
    if (destroyed) return element;
    active = false;
    completed = false;
    state = "paused";
    current = 0;
    anchorValue = current;
    anchorTime = logicalNow();
    clearRenderTimer();
    stopSubscription();
    render();
    return element;
  };
  const setTime = () => element;
  const setLimit = (value) => {
    if (destroyed) return element;
    if (value !== null) validateDuration(value, "limit");
    if (active) updateCurrent();
    timerLimit = value;
    if (timerLimit !== null && current >= timerLimit) {
      if (active) finish();
      else {
        current = timerLimit;
        completed = true;
        state = "finished";
      }
    }
    render();
    return element;
  };
  const setUpdateInterval = (value) => {
    validateUpdateInterval(value);
    interval = value;
    if (active) subscribeTime(value);
    return element;
  };

  const addControls = () => {
    if (!options.buttons) return;
    controls = document.createElement("div");
    controls.className = "webskin-timer__controls";
    for (const [label, action, name] of [["Play", start, "play"], ["Restart", restart, "restart"], ["Resume", resume, "resume"], ["Pause", pause, "pause"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.webskinTimerControl = name;
      button.addEventListener("click", action);
      controls.append(button);
    }
    element.append(display, controls);
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
  addControls();
  if (!controls) element.append(display);
  render();
  widget.addCleanup(() => {
    destroyed = true;
    active = false;
    clearRenderTimer();
    stopSubscription();
    controls?.replaceChildren();
  });
  return element;
}

export { DEFAULT_UPDATE_INTERVAL };
