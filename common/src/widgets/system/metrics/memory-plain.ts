import { createPart, createSystemWidget, fieldsForFormat, renderTokenFormat, resolveFormat } from "./client.js";
import { formatBytes, formatNumber } from "./formatters.js";

const DEFAULT_FORMAT = "Total: {total} {total-unit}\nAvailable: {avail} {avail-unit}\nUsed: {used} {used-unit}\nFree: {free} {free-unit}\nUsage: {usage} %";
const TOKENS = ["total", "total-unit", "avail", "available", "avail-unit", "available-unit", "used", "used-unit", "free", "free-unit", "usage", "percent"];
const TOKEN_FIELDS = {
  total: "memory.virtual.total_bytes",
  "total-unit": "memory.virtual.total_bytes",
  avail: "memory.virtual.available_bytes",
  available: "memory.virtual.available_bytes",
  "avail-unit": "memory.virtual.available_bytes",
  "available-unit": "memory.virtual.available_bytes",
  used: "memory.virtual.used_bytes",
  "used-unit": "memory.virtual.used_bytes",
  free: "memory.virtual.free_bytes",
  "free-unit": "memory.virtual.free_bytes",
  usage: "memory.virtual.percent",
  percent: "memory.virtual.percent",
};

export function createMemory(options = {}) {
  const format = resolveFormat(options.format, DEFAULT_FORMAT, TOKENS, "memory");
  return createSystemWidget({
    ...options,
    fields: fieldsForFormat(format, TOKEN_FIELDS),
    type: "memory",
    build: (root) => root.append(createPart("content", "", "div")),
    render: (root, snapshot, { phase }) => {
      const memory = snapshot?.memory?.virtual;
      const total = formatBytes(memory?.total_bytes, phase);
      const available = formatBytes(memory?.available_bytes, phase);
      const used = formatBytes(memory?.used_bytes, phase);
      const free = formatBytes(memory?.free_bytes, phase);
      renderTokenFormat(root.querySelector('[data-webskin-system-part="content"]'), format, {
        total: total.value,
        "total-unit": total.unit,
        avail: available.value,
        available: available.value,
        "avail-unit": available.unit,
        "available-unit": available.unit,
        used: used.value,
        "used-unit": used.unit,
        free: free.value,
        "free-unit": free.unit,
        usage: formatNumber(memory?.percent, phase),
        percent: formatNumber(memory?.percent, phase),
      }, { fallback: phase === "initial" ? "-" : "n/a" });
    },
  });
}
