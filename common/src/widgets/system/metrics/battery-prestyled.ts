import { createBattery as createPlainBattery } from "./battery-plain.js";
import { createSingleValueSystemWidget, iconAsset, iconFrameAsset } from "./single-value.js";

export function createBatteryPrestyled(options = {}) {
  return createSingleValueSystemWidget({
    ...options,
    type: "battery-prestyled",
    widgetId: "battery-prestyled",
    createPlain: createPlainBattery,
    plainOptions: { ...options, format: "{value}%" },
    label: options.label ?? "Battery",
    icon: iconAsset("battery-bolt-svgrepo-com.svg"),
    iconFrame: iconFrameAsset("puffy.svg"),
  });
}
