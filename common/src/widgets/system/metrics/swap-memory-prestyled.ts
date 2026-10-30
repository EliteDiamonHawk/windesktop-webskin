import { createSwapMemory as createPlainSwapMemory } from "./swap-memory-plain.js";
import { createSingleValueSystemWidget, iconAsset, iconFrameAsset } from "./single-value.js";

export function createSwapMemoryPrestyled(options = {}) {
  const metric = options.metric ?? "usage";
  if (!["total", "used", "free", "usage"].includes(metric)) {
    throw new TypeError("Unsupported swap metric: " + String(metric));
  }
  return createSingleValueSystemWidget({
    ...options,
    type: "swap-memory-prestyled",
    widgetId: "swap-memory-prestyled",
    createPlain: createPlainSwapMemory,
    plainOptions: {
      ...options,
      metric,
      format: metric === "usage" ? "{value}%" : "{value} {unit}",
    },
    label: options.label ?? "Swap",
    icon: iconAsset("microchip-svgrepo-com.svg"),
    iconFrame: iconFrameAsset("cookie-6-sided.svg"),
  });
}
