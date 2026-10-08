import { createVariantSystemWidget, formatNumber } from "./client.js";

export function createCpuLoadAverageMetric(variantOrOptions, options) {
  return createVariantSystemWidget({
    variantOrOptions,
    options,
    defaultVariant: "one-minute",
    family: "cpu-load-average",
    variants: {
      "one-minute": { part: "one-minute", label: "1 minute", read: (snapshot) => formatNumber(snapshot.cpu?.load_average?.one_minute) },
      "five-minutes": { part: "five-minutes", label: "5 minutes", read: (snapshot) => formatNumber(snapshot.cpu?.load_average?.five_minutes) },
      "fifteen-minutes": { part: "fifteen-minutes", label: "15 minutes", read: (snapshot) => formatNumber(snapshot.cpu?.load_average?.fifteen_minutes) },
    },
  });
}
