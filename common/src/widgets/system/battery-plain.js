import { createSystemWidget, formatNumber } from "./client.js";

export const DEFAULT_BATTERY_FORMAT = "<label> <battery-percent> <unit>";

const BATTERY_TAGS = /<(label|battery-percent|unit|power-plugged|secs-left)>/g;

const createBatteryPart = (part, text) => {
  const element = document.createElement("span");
  element.dataset.webskinSystemPart = part;
  element.dataset.webskinBatteryFormatPart = part;
  element.textContent = text;
  return element;
};

const batteryValue = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return formatNumber(value, "", 1).value;
};

const secondsLeftValue = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "Unavailable";
  return formatNumber(value, "", 0).value;
};

const pluggedValue = (value) => {
  if (typeof value !== "boolean") return "Unavailable";
  return String(value);
};

const renderBatteryRow = (row, snapshot, format) => {
  const battery = snapshot?.sensors?.battery;
  const values = {
    label: "Battery",
    "battery-percent": batteryValue(battery?.percent),
    unit: "%",
    "power-plugged": pluggedValue(battery?.power_plugged),
    "secs-left": secondsLeftValue(battery?.seconds_left),
  };

  row.replaceChildren();
  let cursor = 0;
  for (const match of format.matchAll(BATTERY_TAGS)) {
    if (match.index > cursor) row.append(document.createTextNode(format.slice(cursor, match.index)));
    const part = match[1];
    row.append(createBatteryPart(part, values[part]));
    cursor = match.index + match[0].length;
  }
  if (cursor < format.length) row.append(document.createTextNode(format.slice(cursor)));
};

export function createBattery(options = {}) {
  const { format = DEFAULT_BATTERY_FORMAT } = options;
  if (typeof format !== "string") throw new TypeError("System widget format must be a string");

  return createSystemWidget({
    ...options,
    type: "battery",
    build: (root) => {
      const row = document.createElement("div");
      row.dataset.webskinSystemPart = "battery-row";
      row.webskinBatteryFormat = format;
      root.append(row);
    },
    render: (root, snapshot) => {
      const row = root.querySelector('[data-webskin-system-part="battery-row"]');
      if (row) renderBatteryRow(row, snapshot, row.webskinBatteryFormat);
    },
  });
}
