import { smallWidgetFrame } from "../../../frames/small-widget-frame.js";
import { classNames, ensureStyle, maskedAsset } from "../../dom.js";
import { createTimerWidget } from "./timer-runtime.js";

const ICON_ROOT = "/assets/icons/";
const SHAPE_ROOT = "/assets/shapes/";

const ensureStyles = () => ensureStyle("webskin-prestyled-timer-styles", `
  .webskin-timer--prestyled [data-webskin-frame-part="value"] { font-variant-numeric: tabular-nums; }
  .webskin-timer--prestyled [data-webskin-frame-part="actions"] { gap: .3rem; margin-top: .2rem; }
  .webskin-timer--prestyled [data-webskin-frame-part="actions"] button {
    background: var(--webskin-small-widget-color);
    border: 0;
    border-radius: .3rem;
    box-sizing: border-box;
    color: var(--webskin-small-widget-background);
    font: inherit;
    font-size: clamp(.55rem, 7cqw, .75rem);
    height: 1.35rem;
    min-width: 0;
    overflow: hidden;
    padding: 0 .3rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
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
