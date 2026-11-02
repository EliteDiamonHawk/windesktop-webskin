import { smallWidgetFrame } from "../../../frames/small-widget-frame.js";
import { createNetworkTelemetryTransfer as createPlainNetworkTelemetryTransfer } from "./network-telemetry-transfer-plain.js";
import { iconAsset, iconFrameAsset } from "./single-value.js";

export function createNetworkPrestyled(options = {}) {
  const direction = options.direction ?? "download";
  if (!["upload", "download"].includes(direction)) {
    throw new TypeError("Unsupported network direction: " + String(direction));
  }

  const speed = direction + "-speed";
  const unit = speed + "-unit";
  const label = options.label ?? (direction === "upload" ? "Upload" : "Download");
  const digitLimit = options.digitLimit ?? 5;
  const element = smallWidgetFrame({
    className: options.className,
    subtext: "",
    icon: iconAsset("arrow-right-svgrepo-com.svg"),
    iconFrame: iconFrameAsset("arrow.svg"),
    color: options.color,
    backgroundColor: options.backgroundColor,
    borderColor: options.borderColor,
    subtextColor: options.subtextColor,
    iconFrameColor: options.iconFrameColor,
    iconColor: options.iconColor,
  });

  createPlainNetworkTelemetryTransfer({
    ...options,
    widgetId: "network-prestyled",
    format: "{" + speed + "}",
    digitLimit,
    element,
    contentRoot: element.parts.value,
    rootType: "network-prestyled",
    variant: "prestyled",
  });
  const primaryDestroy = element.destroy;

  createPlainNetworkTelemetryTransfer({
    ...options,
    widgetId: "network-prestyled",
    format: label + " {" + unit + "}/s",
    digitLimit,
    contentTag: "span",
    element: element.parts.subtext,
    contentRoot: element.parts.subtext,
    rootType: "network-prestyled-subtext",
    variant: "prestyled",
  });
  const subtextDestroy = element.parts.subtext.destroy;

  Object.defineProperty(element, "destroy", {
    configurable: true,
    value: () => {
      subtextDestroy?.();
      primaryDestroy?.();
    },
  });
  return element;
}
