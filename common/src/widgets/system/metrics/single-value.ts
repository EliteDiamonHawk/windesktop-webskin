import { smallWidgetFrame } from "../../../frames/small-widget-frame.js";
import { classNames, maskedAsset } from "../../dom.js";

const ICON_ROOT = "/assets/icons/";
const SHAPE_ROOT = "/assets/shapes/";

export const iconAsset = (name) => maskedAsset(ICON_ROOT, name);
export const iconFrameAsset = (name) => maskedAsset(SHAPE_ROOT, name);

export const createSingleValueSystemWidget = ({
  type,
  widgetId,
  className = "",
  label,
  icon,
  iconFrame,
  color,
  backgroundColor,
  borderColor,
  subtextColor,
  iconFrameColor,
  iconColor,
  createPlain,
  plainOptions = {},
  proxyMethods = [],
} = {}) => {
  if (typeof createPlain !== "function") throw new TypeError("Single-value system widgets require a plain widget constructor");

  const element = smallWidgetFrame({
    className: classNames(className),
    subtext: label,
    icon,
    iconFrame,
    color,
    backgroundColor,
    borderColor,
    subtextColor,
    iconFrameColor,
    iconColor,
  });

  const plain = createPlain({
    ...plainOptions,
    widgetId,
    element,
    contentRoot: element.parts.value,
    rootType: type,
    variant: "prestyled",
  });

  for (const method of proxyMethods) {
    const implementation = plain[method];
    if (typeof implementation !== "function" || plain === element) continue;
    Object.defineProperty(element, method, {
      configurable: true,
      value: (...args) => implementation.apply(plain, args),
    });
  }
  return plain;
};
