import { PlainTimer } from "./timer.js";

/** Create a paused plain stopwatch. Limit and elapsed time use milliseconds. */
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
