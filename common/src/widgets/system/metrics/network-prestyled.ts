import { createNetworkTelemetryTransfer as createPlainNetworkTelemetryTransfer } from "./network-telemetry-transfer-plain.js";
import { createSingleValueSystemWidget, iconAsset, iconFrameAsset } from "./single-value.js";

export function createNetworkPrestyled(options = {}) {
  const direction = options.direction ?? "download";
  if (!["upload", "download"].includes(direction)) {
    throw new TypeError("Unsupported network direction: " + String(direction));
  }
  const rate = direction === "upload" ? "upload-rate" : "download-rate";
  return createSingleValueSystemWidget({
    ...options,
    type: "network-prestyled",
    widgetId: "network-prestyled",
    createPlain: createPlainNetworkTelemetryTransfer,
    plainOptions: { ...options, format: "{" + rate + "}" },
    label: options.label ?? (direction === "upload" ? "Upload" : "Download"),
    icon: iconAsset("arrow-right-svgrepo-com.svg"),
    iconFrame: iconFrameAsset("arrow.svg"),
  });
}
