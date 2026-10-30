import { PlainTimer } from "./timer.js";

export function createCountdown(options = {}) {
  if (options.time === undefined) throw new TypeError("Countdown requires time");
  return new PlainTimer({
    kind: "countdown",
    time: options.time,
    updateInterval: options.updateInterval,
    endpoint: options.endpoint,
    className: options.className,
    buttons: options.buttons,
  }).element;
}
