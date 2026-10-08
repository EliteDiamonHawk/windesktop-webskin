import { createVariantSystemWidget, formatBytes, formatNumber } from "./client.js";

export function createSwapMetric(variantOrOptions, options) {
  return createVariantSystemWidget({
    variantOrOptions,
    options,
    defaultVariant: "used",
    family: "swap",
    variants: {
      total: { part: "total", label: "Total", read: (snapshot) => formatBytes(snapshot.memory?.swap?.total_bytes) },
      used: { part: "used", label: "Used", read: (snapshot) => formatBytes(snapshot.memory?.swap?.used_bytes) },
      free: { part: "free", label: "Free", read: (snapshot) => formatBytes(snapshot.memory?.swap?.free_bytes) },
      percent: { part: "paging-percent", label: "Paging usage", read: (snapshot) => formatNumber(snapshot.memory?.swap?.percent, "%") },
    },
  });
}
