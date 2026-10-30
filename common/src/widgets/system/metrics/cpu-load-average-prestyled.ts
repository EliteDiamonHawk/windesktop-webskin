import { createCpuLoadAverage as createPlainCpuLoadAverage } from "./cpu-load-average-plain.js";
import { createSingleValueSystemWidget, iconAsset, iconFrameAsset } from "./single-value.js";

export function createCpuLoadAveragePrestyled(options = {}) {
  const windowName = options.window ?? "one_minute";
  if (!["one_minute", "five_minutes", "fifteen_minutes"].includes(windowName)) {
    throw new TypeError("Unsupported CPU load window: " + String(windowName));
  }
  const token = {
    one_minute: "one",
    five_minutes: "five",
    fifteen_minutes: "fifteen",
  }[windowName];
  return createSingleValueSystemWidget({
    ...options,
    type: "cpu-load-average-prestyled",
    widgetId: "cpu-load-average-prestyled",
    createPlain: createPlainCpuLoadAverage,
    plainOptions: { ...options, format: "{" + token + "}", digits: 2 },
    label: options.label ?? "Load",
    icon: iconAsset("wave-pulse-svgrepo-com.svg"),
    iconFrame: iconFrameAsset("burst.svg"),
  });
}
