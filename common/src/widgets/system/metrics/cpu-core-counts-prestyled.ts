import { createCpuCoreCounts as createPlainCpuCoreCounts } from "./cpu-core-counts-plain.js";
import { createSingleValueSystemWidget, iconAsset, iconFrameAsset } from "./single-value.js";

export function createCpuCoreCountsPrestyled(options = {}) {
  const coreType = options.coreType ?? "logical";
  if (!["physical", "logical"].includes(coreType)) {
    throw new TypeError("Unsupported CPU core type: " + String(coreType));
  }
  return createSingleValueSystemWidget({
    ...options,
    type: "cpu-core-counts-prestyled",
    widgetId: "cpu-core-counts-prestyled",
    createPlain: createPlainCpuCoreCounts,
    plainOptions: {
      ...options,
      format: coreType === "physical" ? "{physical}" : "{logical}",
    },
    label: options.label ?? (coreType === "physical" ? "Physical cores" : "Logical cores"),
    icon: iconAsset("microchip-svgrepo-com.svg"),
    iconFrame: iconFrameAsset("clover-8-leaf.svg"),
  });
}
