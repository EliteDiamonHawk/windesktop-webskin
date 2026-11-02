import { createCpuFrequency as createPlainCpuFrequency } from "./cpu-frequency-plain.js";
import { createSingleValueSystemWidget, iconAsset, iconFrameAsset } from "./single-value.js";
import { requireInteger } from "./validation.js";

export function createCpuFrequencyPrestyled(options = {}) {
  const core = options.core === undefined ? -1 : requireInteger(options, "core");
  return createSingleValueSystemWidget({
    ...options,
    type: "cpu-frequency-prestyled",
    widgetId: "cpu-frequency-prestyled",
    createPlain: createPlainCpuFrequency,
    plainOptions: { ...options, format: "{current}", digits: 0, digitLimit: options.digitLimit ?? 5 },
    label: options.label ?? "CPU",
    icon: iconAsset("wave-pulse-svgrepo-com.svg"),
    iconFrame: iconFrameAsset("cookie-4-sided.svg"),
  });
}
