import { Widget } from "../../widgets.js";
import { ensureStyle, rejectLegacyInterval } from "../../dom.js";
import { timerTimeManager } from "./timers.js";
import { formatDuration } from "./timer-format.js";

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

export const ensureTimerStyles = () => ensureStyle(STYLE_ID, `
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
`);

const controlDefinitions = {
  initial: [["Play", "start"], ["Restart", "restart"]],
  paused: [["Resume", "resume"], ["Restart", "restart"]],
  running: [["Pause", "pause"], ["Restart", "restart"]],
  finished: [["Restart", "restart"]],
};

export const createTimerWidget = ({
  type,
  options = {},
  element,
  display,
  controlsRoot,
  compactControls = false,
} = {}) => {
  rejectLegacyInterval(options);
  ensureTimerStyles();
  if (!element || !display) throw new TypeError("Timer runtime requires root and display elements");

  const widget = new Widget(element, { type: "timer", variant: options.variant ?? "plain" });
  element.setAttribute("aria-live", "polite");
  element.dataset.webskinTimerType = type;
  display.dataset.webskinTimerPart = "display";
  display.setAttribute("aria-label", type === "countdown" ? "Countdown timer" : "Stopwatch timer");

  const countdown = type === "countdown";
  if (countdown && options.time === undefined) throw new TypeError("Countdown requires time");
  const initial = countdown ? validateDuration(options.time, "time") : 0;
  if (!countdown && options.limit !== undefined && options.limit !== null) {
    validateDuration(options.limit, "limit");
  }
  let updateIntervalSeconds = options.updateInterval ?? DEFAULT_UPDATE_INTERVAL;
  validateUpdateInterval(updateIntervalSeconds);

  let current = initial;
  let timerLimit = countdown ? null : options.limit ?? null;
  let active = false;
  let completed = false;
  let state = "paused";
  let anchorValue = current;
  let anchorTime = Date.now();
  let clockOffset = 0;
  let renderTimer;
  let unsubscribeTime;
  let destroyed = false;
  let controls = controlsRoot;
  let controlsListeners = [];

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
    display.textContent = formatDuration(current, options.syntax);
    element.dataset.webskinTimerState = state;
    element.dataset.webskinTimerStarted = element.dataset.webskinTimerStarted ?? "false";
    element.dataset.webskinTimerMilliseconds = String(Math.max(0, Math.floor(current)));
    widget.setState("ready");
  };
  const finish = () => {
    current = countdown ? 0 : timerLimit ?? current;
    active = false;
    completed = true;
    state = "finished";
    clearRenderTimer();
    stopSubscription();
    render();
    renderControls();
  };
  const updateCurrent = (now = logicalNow()) => {
    if (!active) return current;
    current = countdown
      ? Math.max(0, anchorValue - Math.max(0, now - anchorTime))
      : anchorValue + Math.max(0, now - anchorTime);
    if ((countdown && current <= 0) || (!countdown && timerLimit !== null && current >= timerLimit)) finish();
    else render();
    return current;
  };
  const scheduleRender = () => {
    if (!active || destroyed) return;
    if (renderTimer !== undefined) timerHost().clearTimeout(renderTimer);
    renderTimer = timerHost().setTimeout(() => {
      renderTimer = undefined;
      updateCurrent();
      if (active) scheduleRender();
    }, Math.max(1, 1000 - (Date.now() % 1000)));
  };
  const subscribeTime = (seconds = updateIntervalSeconds) => {
    stopSubscription();
    unsubscribeTime = timerTimeManager.subscribe({
      endpoint: options.endpoint ?? TIME_ENDPOINT,
      updateInterval: seconds,
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
    if (destroyed || active || completed || (countdown && current <= 0)) return element;
    if (!countdown && timerLimit === 0) {
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
    renderControls();
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
    renderControls();
    return element;
  };
  const resume = () => start();
  const restart = () => {
    if (destroyed) return element;
    active = false;
    completed = false;
    state = "paused";
    current = initial;
    anchorValue = current;
    anchorTime = logicalNow();
    clearRenderTimer();
    stopSubscription();
    render();
    renderControls();
    return element;
  };
  const setTime = (value) => {
    if (!countdown) throw new TypeError("setTime is only supported by countdown timers");
    if (destroyed) return element;
    validateDuration(value, "time");
    active = false;
    completed = false;
    state = "paused";
    current = value;
    anchorValue = value;
    anchorTime = logicalNow();
    clearRenderTimer();
    stopSubscription();
    render();
    renderControls();
    return element;
  };
  const setLimit = (value) => {
    if (countdown) throw new TypeError("setLimit is only supported by stopwatch timers");
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
    renderControls();
    return element;
  };
  const setUpdateInterval = (value) => {
    validateUpdateInterval(value);
    updateIntervalSeconds = value;
    if (active) subscribeTime(value);
    return element;
  };

  const clearControls = () => {
    controlsListeners.splice(0).forEach(({ button, action }) => button.removeEventListener("click", action));
    controls?.replaceChildren();
  };
  function renderControls() {
    if (!controls) return;
    clearControls();
    const definitions = compactControls
      ? (state === "paused" && element.dataset.webskinTimerStarted !== "true"
        ? controlDefinitions.initial
        : controlDefinitions[state])
      : [["Play", "start"], ["Restart", "restart"], ["Resume", "resume"], ["Pause", "pause"]];
    definitions.forEach(([label, method]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.webskinTimerControl = method;
      const action = () => element[method]();
      button.addEventListener("click", action);
      controls.append(button);
      controlsListeners.push({ button, action });
    });
  }

  Object.defineProperty(element, "start", { configurable: true, value: start });
  Object.defineProperty(element, "pause", { configurable: true, value: pause });
  Object.defineProperty(element, "resume", { configurable: true, value: resume });
  Object.defineProperty(element, "restart", { configurable: true, value: restart });
  Object.defineProperty(element, "setUpdateInterval", { configurable: true, value: setUpdateInterval });
  if (countdown) Object.defineProperty(element, "setTime", { configurable: true, value: setTime });
  else Object.defineProperty(element, "setLimit", { configurable: true, value: setLimit });

  element.dataset.webskinTimerStarted = "false";
  render();
  renderControls();
  widget.addCleanup(() => {
    destroyed = true;
    active = false;
    clearRenderTimer();
    stopSubscription();
    clearControls();
  });
  return element;
};

export { DEFAULT_UPDATE_INTERVAL };
