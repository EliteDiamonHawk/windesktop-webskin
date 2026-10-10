import { createPart, createSystemWidget, fieldsForFormat, renderTokenFormat, resolveFormat } from "./client.js";
import { formatBoolean, formatNumber } from "./formatters.js";

const DEFAULT_FORMAT = "{value} %";
const TOKENS = ["value", "plugged", "time-left"];
const TOKEN_FIELDS = {
  value: "sensors.battery.percent",
  plugged: "sensors.battery.power_plugged",
  "time-left": "sensors.battery.seconds_left",
};

export function createBattery(options = {}) {
  const format = resolveFormat(options.format, DEFAULT_FORMAT, TOKENS, "battery");
  return createSystemWidget({
    ...options,
    fields: fieldsForFormat(format, TOKEN_FIELDS),
    type: "battery",
    build: (root) => root.append(createPart("content", "", "div")),
    render: (root, snapshot, { phase }) => {
      const battery = snapshot?.sensors?.battery;
      const seconds = typeof battery?.seconds_left === "number" && battery.seconds_left >= 0
        ? battery.seconds_left
        : null;
      renderTokenFormat(root.querySelector('[data-webskin-system-part="content"]'), format, {
        value: formatNumber(battery?.percent, phase),
        plugged: formatBoolean(battery?.power_plugged, phase),
        "time-left": formatNumber(seconds, phase, 0),
      }, { fallback: phase === "initial" ? "-" : "n/a" });
    },
  });
}
