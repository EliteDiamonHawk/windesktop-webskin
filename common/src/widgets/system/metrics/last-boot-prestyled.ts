import { createLastBoot as createPlainLastBoot } from "./last-boot-plain.js";
import { createSingleValueSystemWidget, iconAsset, iconFrameAsset } from "./single-value.js";

export function createLastBootPrestyled(options = {}) {
  const updateInterval = options.updateInterval ?? 60;
  return createSingleValueSystemWidget({
    ...options,
    type: "last-boot-prestyled",
    widgetId: "last-boot-prestyled",
    createPlain: createPlainLastBoot,
    plainOptions: { ...options, format: "{uptime} s", updateInterval },
    proxyMethods: ["subscribeBootTime", "unsubscribeBootTime"],
    label: options.label ?? "Uptime",
    icon: iconAsset("clock-eight-svgrepo-com.svg"),
    iconFrame: iconFrameAsset("circle.svg"),
  });
}
