import { createPart, createSystemWidget, fieldsForFormat, renderTokenFormat, resolveFormat } from "./client.js";
import { formatNumber } from "./formatters.js";

const DEFAULT_FORMAT = "1: {one}\n5: {five}\n15: {fifteen}";
const TOKENS = ["one", "one-min", "one-minute", "five", "five-min", "five-minute", "fift", "fifteen", "fifteen-min", "fifteen-minute"];
const TOKEN_FIELDS = {
  one: "cpu.load_average.one_minute",
  "one-min": "cpu.load_average.one_minute",
  "one-minute": "cpu.load_average.one_minute",
  five: "cpu.load_average.five_minutes",
  "five-min": "cpu.load_average.five_minutes",
  "five-minute": "cpu.load_average.five_minutes",
  fift: "cpu.load_average.fifteen_minutes",
  fifteen: "cpu.load_average.fifteen_minutes",
  "fifteen-min": "cpu.load_average.fifteen_minutes",
  "fifteen-minute": "cpu.load_average.fifteen_minutes",
};

export function createCpuLoadAverage(options = {}) {
  const format = resolveFormat(options.format, DEFAULT_FORMAT, TOKENS, "CPU load average");
  return createSystemWidget({
    ...options,
    fields: fieldsForFormat(format, TOKEN_FIELDS),
    type: "cpu-load-average",
    build: (root) => root.append(createPart("content", "", "div")),
    render: (root, snapshot, { phase }) => {
      const load = snapshot?.cpu?.load_average;
      const values = {
        one: formatNumber(load?.one_minute, phase),
        "one-min": formatNumber(load?.one_minute, phase),
        "one-minute": formatNumber(load?.one_minute, phase),
        five: formatNumber(load?.five_minutes, phase),
        "five-min": formatNumber(load?.five_minutes, phase),
        "five-minute": formatNumber(load?.five_minutes, phase),
        fift: formatNumber(load?.fifteen_minutes, phase),
        fifteen: formatNumber(load?.fifteen_minutes, phase),
        "fifteen-min": formatNumber(load?.fifteen_minutes, phase),
        "fifteen-minute": formatNumber(load?.fifteen_minutes, phase),
      };
      renderTokenFormat(root.querySelector('[data-webskin-system-part="content"]'), format, values, {
        fallback: phase === "initial" ? "-" : "n/a",
      });
    },
  });
}
