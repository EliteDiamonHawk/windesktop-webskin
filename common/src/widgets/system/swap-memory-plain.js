import { createPart, createSystemWidget, fieldsForFormat, renderTokenFormat, resolveFormat } from "./client.js";
import { formatBytes, formatNumber } from "./formatters.js";

const SUMMARY_FORMAT = "Total: {total} {total-unit}\nUsed: {used} {used-unit}\nFree: {free} {free-unit}\nUsage: {usage} %";
const SUMMARY_TOKENS = ["total", "total-unit", "used", "used-unit", "free", "free-unit", "usage", "percent"];
const SUMMARY_FIELDS = {
  total: "memory.swap.total_bytes",
  "total-unit": "memory.swap.total_bytes",
  used: "memory.swap.used_bytes",
  "used-unit": "memory.swap.used_bytes",
  free: "memory.swap.free_bytes",
  "free-unit": "memory.swap.free_bytes",
  usage: "memory.swap.percent",
  percent: "memory.swap.percent",
};

const SCALAR_FIELDS = {
  value: "memory.swap.used_bytes",
  unit: "memory.swap.used_bytes",
};

export function createSwapMemory(options = {}) {
  const metric = options.metric;
  const validMetrics = ["total", "used", "free", "usage"];
  if (metric !== undefined && !validMetrics.includes(metric)) {
    throw new TypeError("Unsupported swap metric: " + String(metric));
  }
  const scalar = metric !== undefined;
  const defaultFormat = scalar
    ? (metric === "usage" ? "{value} %" : "{value} {unit}")
    : SUMMARY_FORMAT;
  const tokens = scalar ? ["value", "unit"] : SUMMARY_TOKENS;
  const tokenFields = scalar
    ? {
      value: metric === "usage" ? "memory.swap.percent" : "memory.swap." + metric + "_bytes",
      unit: metric === "usage" ? "memory.swap.percent" : "memory.swap." + metric + "_bytes",
    }
    : SUMMARY_FIELDS;
  const format = resolveFormat(options.format, defaultFormat, tokens, "swap memory");
  return createSystemWidget({
    ...options,
    fields: fieldsForFormat(format, tokenFields),
    type: "swap-memory",
    build: (root) => root.append(createPart("content", "", "div")),
    render: (root, snapshot, { phase }) => {
      const swap = snapshot?.memory?.swap;
      if (scalar) {
        const raw = metric === "usage" ? swap?.percent : swap?.[metric + "_bytes"];
        const bytes = metric === "usage" ? null : formatBytes(raw, phase);
        renderTokenFormat(root.querySelector('[data-webskin-system-part="content"]'), format, {
          value: metric === "usage" ? formatNumber(raw, phase) : bytes.value,
          unit: metric === "usage" ? "%" : bytes.unit,
        }, { fallback: phase === "initial" ? "-" : "n/a" });
        return;
      }
      const total = formatBytes(swap?.total_bytes, phase);
      const used = formatBytes(swap?.used_bytes, phase);
      const free = formatBytes(swap?.free_bytes, phase);
      renderTokenFormat(root.querySelector('[data-webskin-system-part="content"]'), format, {
        total: total.value,
        "total-unit": total.unit,
        used: used.value,
        "used-unit": used.unit,
        free: free.value,
        "free-unit": free.unit,
        usage: formatNumber(swap?.percent, phase),
        percent: formatNumber(swap?.percent, phase),
      }, { fallback: phase === "initial" ? "-" : "n/a" });
    },
  });
}
