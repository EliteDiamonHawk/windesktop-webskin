import { createVariantSystemWidget, formatNumber } from "./client.js";

export function createCpuCoreCountMetric(variantOrOptions, options) {
  return createVariantSystemWidget({
    variantOrOptions,
    options,
    defaultVariant: "physical",
    family: "cpu-core-count",
    variants: {
      physical: { part: "physical", label: "Physical", read: (snapshot) => formatNumber(snapshot.cpu?.cores?.physical, "", 0) },
      logical: { part: "logical", label: "Logical", read: (snapshot) => formatNumber(snapshot.cpu?.cores?.logical, "", 0) },
    },
  });
}
