import { smallWidgetFrame } from "../../../frames/small-widget-frame.js";
import { classNames, ensureStyle, maskedAsset } from "../../dom.js";
import { createTimerWidget } from "./timer-runtime.js";

const ICON_ROOT = "/common/assets/icons/";
const SHAPE_ROOT = "/common/assets/shapes/";
const MAX_TIME = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const timerHost = () => (typeof window === "undefined" ? globalThis : window);

const ensureStyles = () => ensureStyle("webskin-prestyled-timer-styles", `
  .webskin-timer--prestyled [data-webskin-frame-part="value"] { font-variant-numeric: tabular-nums; }
`);

export function createCountdown(options = {}) {
  ensureStyles();
  const initialTime = options.time === undefined ? 0 : options.time;
  let addingTime = initialTime === 0;
  let debounceTimer;
  const element = smallWidgetFrame({
    className: classNames("webskin-timer", "webskin-timer--countdown", "webskin-timer--prestyled", options.className),
    subtext: options.label ?? "Countdown",
    icon: maskedAsset(ICON_ROOT, "hourglass-half-svgrepo-com.svg"),
    iconFrame: maskedAsset(SHAPE_ROOT, "soft-burst.svg"),
    color: options.color,
    backgroundColor: options.backgroundColor,
    borderColor: options.borderColor,
    subtextColor: options.subtextColor,
    iconFrameColor: options.iconFrameColor,
    iconColor: options.iconColor,
  });
  const clearDebounce = () => {
    if (debounceTimer !== undefined) timerHost().clearTimeout(debounceTimer);
    debounceTimer = undefined;
  };
  const addTime = (amount) => {
    addingTime = true;
    const current = Number(element.dataset.webskinTimerMilliseconds) || 0;
    element.setTime(Math.min(MAX_TIME, current + amount));
    clearDebounce();
    debounceTimer = timerHost().setTimeout(() => {
      debounceTimer = undefined;
      const nextValue = Number(element.dataset.webskinTimerMilliseconds) || 0;
      if (nextValue > 0) {
        addingTime = false;
        element.setTime(nextValue);
      }
    }, 1000);
    return element;
  };
  const timer = createTimerWidget({
    type: "countdown",
    options: {
      ...options,
      time: initialTime,
      syntax: options.syntax ?? "MM:ss",
      variant: "prestyled",
    },
    maxDuration: MAX_TIME,
    restartValue: 0,
    element,
    display: element.parts.value,
    controlsRoot: options.buttons === false ? null : element.parts.actions,
    compactControls: true,
    controlResolver: ({ state, current }) => {
      if (current === 0 || addingTime) {
        return [
          ["+1min", () => addTime(MINUTE), "add-1min"],
          ["+5min", () => addTime(5 * MINUTE), "add-5min"],
        ];
      }
      return [
        [state === "running" ? "Pause" : "Resume", state === "running" ? "pause" : "resume"],
        ["Restart", "restart"],
      ];
    },
    onCleanup: clearDebounce,
  });
  const originalRestart = timer.restart;
  Object.defineProperty(timer, "restart", {
    configurable: true,
    value: () => {
      clearDebounce();
      addingTime = false;
      return originalRestart();
    },
  });
  return timer;
}
