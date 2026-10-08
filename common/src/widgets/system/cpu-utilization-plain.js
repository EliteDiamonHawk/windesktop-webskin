import { createVariantSystemWidget, formatNumber, requireNonNegativeInteger } from "./client.js";

export function createCpuUtilization(variantOrOptions, options) {
  return createVariantSystemWidget({
    variantOrOptions,
    options,
    defaultVariant: "overall",
    family: "cpu-utilization",
    variants: {
      overall: { part: "overall", label: "Overall", read: (snapshot) => formatNumber(snapshot.cpu?.utilization?.overall, "%") },
      core: (widgetOptions) => {
        const core = requireNonNegativeInteger(widgetOptions, "core");
        return { part: "core", label: `Core ${core + 1}`, read: (snapshot) => formatNumber(snapshot.cpu?.utilization?.per_core?.[core], "%") };
      },
    },
  });
}
