import { PlainTimer } from "./timer.js";

export function createStopwatch(options = {}) {
  return new PlainTimer({
    kind: "stopwatch",
    limit: options.limit,
    updateInterval: options.updateInterval,
    endpoint: options.endpoint,
    className: options.className,
    buttons: options.buttons,
  }).element;
}
