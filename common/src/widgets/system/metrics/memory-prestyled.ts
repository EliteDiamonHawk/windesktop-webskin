import { createMemory as createPlainMemory } from "./memory-plain.js";
import { createSingleValueSystemWidget, iconAsset, iconFrameAsset } from "./single-value.js";

export function createMemoryPrestyled(options = {}) {
  return createSingleValueSystemWidget({
    ...options,
    type: "memory-prestyled",
    widgetId: "memory-prestyled",
    createPlain: createPlainMemory,
    plainOptions: { ...options, format: "{usage}%" },
    label: options.label ?? "RAM",
    icon: iconAsset("microchip-svgrepo-com.svg"),
    iconFrame: iconFrameAsset("clover-4-leaf.svg"),
  });
}
