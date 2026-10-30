import { smallWidgetFrame } from "../../../frames/small-widget-frame.js";
import { Widget } from "../../widgets.js";

const ICON_ROOT = "/assets/icons/";
const SHAPE_ROOT = "/assets/shapes/";

const assetImage = (root, name) => {
  const image = document.createElement("span");
  const url = `url("${root + name}")`;
  image.style.setProperty("background-color", "currentColor");
  image.style.setProperty("mask-image", url);
  image.style.setProperty("mask-position", "center");
  image.style.setProperty("mask-repeat", "no-repeat");
  image.style.setProperty("mask-size", "contain");
  image.style.setProperty("-webkit-mask-image", url);
  image.style.setProperty("-webkit-mask-position", "center");
  image.style.setProperty("-webkit-mask-repeat", "no-repeat");
  image.style.setProperty("-webkit-mask-size", "contain");
  image.setAttribute("aria-hidden", "true");
  return image;
};

export const iconAsset = (name) => assetImage(ICON_ROOT, name);
export const iconFrameAsset = (name) => assetImage(SHAPE_ROOT, name);

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

  const plain = createPlain({ ...plainOptions, widgetId });
  const content = plain.querySelector?.('[data-webskin-system-part="content"]');
  if (!content) {
    plain.destroy?.();
    throw new TypeError("Plain system widget must expose a content node");
  }

  const element = smallWidgetFrame({
    className: ["webskin-system-widget", "webskin-system-widget--" + type, className].filter(Boolean).join(" "),
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
  const widget = new Widget(element, { type: "system" });
  element.setAttribute("aria-live", "polite");
  element.dataset.webskinSystemType = type;
  element.parts.value.append(content);

  for (const method of proxyMethods) {
    if (typeof plain[method] !== "function") continue;
    Object.defineProperty(element, method, {
      configurable: true,
      value: (...args) => plain[method](...args),
    });
  }
  widget.addCleanup(() => plain.destroy?.());
  return element;
};
