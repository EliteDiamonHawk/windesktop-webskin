import { smallWidgetFrame } from "../../../frames/small-widget-frame.js";
import { classNames, ensureStyle, maskedAsset } from "../../dom.js";
import { createTimerWidget } from "./timer-runtime.js";

const ICON_ROOT = "/common/assets/icons/";
const SHAPE_ROOT = "/common/assets/shapes/";

const ensureStyles = () => ensureStyle("webskin-prestyled-timer-styles", `
  .webskin-timer--prestyled [data-webskin-frame-part="value"] { font-variant-numeric: tabular-nums; }
`);

export function createCountdown(options = {}) {
  if (options.time === undefined) throw new TypeError("Countdown requires time");
  ensureStyles();
  const element = smallWidgetFrame({
    className: classNames("webskin-timer", "webskin-timer--countdown", "webskin-timer--prestyled", options.className),
    subtext: options.label ?? "Countdown",
    icon: maskedAsset(ICON_ROOT, "hourglass-half-svgrepo-com.svg"),
    iconFrame: maskedAsset(SHAPE_ROOT, "soft-burst.svg"),
    color: options.color,
    backgroundColor: options.backgroundColor,
    borderColor: options.borderColor,
    subtextColor: options.subtextColor,
    iconFrameColor: options.iconFrameColor,
    iconColor: options.iconColor,
  });
  return createTimerWidget({
    type: "countdown",
    options: { ...options, variant: "prestyled" },
    element,
    display: element.parts.value,
    controlsRoot: options.buttons === false ? null : element.parts.actions,
    compactControls: true,
  });
}
