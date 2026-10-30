import { createCpuUtilization as createPlainCpuUtilization } from "./cpu-utilization-plain.js";
import { createSingleValueSystemWidget, iconAsset, iconFrameAsset } from "./single-value.js";
import { requireInteger } from "./validation.js";

export function createCpuUtilizationPrestyled(options = {}) {
  const core = options.core === undefined ? -1 : requireInteger(options, "core");
  return createSingleValueSystemWidget({
    ...options,
    type: "cpu-utilization-prestyled",
    widgetId: "cpu-utilization-prestyled",
    createPlain: createPlainCpuUtilization,
    plainOptions: { ...options, format: "{value}%" },
    label: options.label ?? "CPU",
    icon: iconAsset("wave-pulse-svgrepo-com.svg"),
    iconFrame: iconFrameAsset("flower.svg"),
  });
}
