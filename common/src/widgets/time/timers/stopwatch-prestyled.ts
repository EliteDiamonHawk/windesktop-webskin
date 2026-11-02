import { smallWidgetFrame } from "../../../frames/small-widget-frame.js";
import { classNames, ensureStyle, maskedAsset } from "../../dom.js";
import { createTimerWidget } from "./timer-runtime.js";

const ICON_ROOT = "/common/assets/icons/";
const SHAPE_ROOT = "/common/assets/shapes/";
const MAX_TIME = 59 * 60 * 1000 + 59 * 1000;

const ensureStyles = () => ensureStyle("webskin-prestyled-timer-styles", `
  .webskin-frame--small-widget.webskin-timer--prestyled [data-webskin-frame-part="value"] {
    --webskin-prestyled-timer-value-scale: .8;
    font-size: calc(20cqw * var(--webskin-prestyled-timer-value-scale));
    font-variant-numeric: tabular-nums;
  }
`);

export function createStopwatch(options = {}) {
  ensureStyles();
  const element = smallWidgetFrame({
    className: classNames("webskin-timer", "webskin-timer--stopwatch", "webskin-timer--prestyled", options.className),
    subtext: options.label ?? "Stopwatch",
    icon: maskedAsset(ICON_ROOT, "stopwatch-svgrepo-com.svg"),
    iconFrame: maskedAsset(SHAPE_ROOT, "flower.svg"),
    color: options.color,
    backgroundColor: options.backgroundColor,
    borderColor: options.borderColor,
    subtextColor: options.subtextColor,
    iconFrameColor: options.iconFrameColor,
    iconColor: options.iconColor,
  });
  return createTimerWidget({
    type: "stopwatch",
    options: {
      ...options,
      limit: options.limit ?? MAX_TIME,
      syntax: options.syntax ?? "mm:ss",
      variant: "prestyled",
    },
    maxDuration: MAX_TIME,
    element,
    display: element.parts.value,
    controlsRoot: options.buttons === false ? null : element.parts.actions,
    compactControls: true,
  });
}
