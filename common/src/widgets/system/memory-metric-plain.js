import { createVariantSystemWidget, formatBytes, formatNumber } from "./client.js";

export function createMemoryMetric(variantOrOptions, options) {
  return createVariantSystemWidget({
    variantOrOptions,
    options,
    defaultVariant: "used",
    family: "memory",
    variants: {
      total: { part: "total", label: "Total", read: (snapshot) => formatBytes(snapshot.memory?.virtual?.total_bytes) },
      available: { part: "available", label: "Available", read: (snapshot) => formatBytes(snapshot.memory?.virtual?.available_bytes) },
      used: { part: "used", label: "Used", read: (snapshot) => formatBytes(snapshot.memory?.virtual?.used_bytes) },
      free: { part: "free", label: "Free", read: (snapshot) => formatBytes(snapshot.memory?.virtual?.free_bytes) },
      percent: { part: "percent", label: "Usage", read: (snapshot) => formatNumber(snapshot.memory?.virtual?.percent, "%") },
    },
  });
}
