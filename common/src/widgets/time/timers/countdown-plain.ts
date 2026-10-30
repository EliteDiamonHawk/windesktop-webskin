import { createTimerWidget, ensureTimerStyles, validateDuration, validateUpdateInterval } from "./timer-runtime.js";
import { formatDuration } from "./timer-format.js";
import { classNames } from "../../dom.js";

export { formatDuration, validateDuration, validateUpdateInterval };

export function createCountdown(options = {}) {
  ensureTimerStyles();
  const element = document.createElement("section");
  const display = document.createElement("time");
  element.className = classNames("webskin-timer", "webskin-timer--countdown", "webskin-timer--plain", options.className);
  element.append(display);
  let controls;
  if (options.buttons) {
    controls = document.createElement("div");
    controls.className = "webskin-timer__controls";
    element.append(controls);
  }
  return createTimerWidget({ type: "countdown", options, element, display, controlsRoot: controls });
}

export { DEFAULT_UPDATE_INTERVAL } from "./timer-runtime.js";
