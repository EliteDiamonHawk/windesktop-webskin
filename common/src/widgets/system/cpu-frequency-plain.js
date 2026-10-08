import { createVariantSystemWidget, formatNumber, requireNonNegativeInteger } from "./client.js";

export function createCpuFrequency(variantOrOptions, options) {
  return createVariantSystemWidget({
    variantOrOptions,
    options,
    defaultVariant: "core",
    family: "cpu-frequency",
    variants: {
      core: (widgetOptions) => {
        const core = requireNonNegativeInteger(widgetOptions, "core");
        return { part: "core", label: `Core ${core + 1}`, read: (snapshot) => formatNumber(snapshot.cpu?.frequencies?.per_core?.[core]?.current_mhz, "MHz") };
      },
      current: { part: "current", label: "Current", read: (snapshot) => formatNumber(snapshot.cpu?.frequencies?.current_mhz, "MHz") },
      max: { part: "maximum", label: "Maximum", read: (snapshot) => formatNumber(snapshot.cpu?.frequencies?.maximum_mhz, "MHz") },
      min: { part: "minimum", label: "Minimum", read: (snapshot) => formatNumber(snapshot.cpu?.frequencies?.minimum_mhz, "MHz") },
    },
  });
}
