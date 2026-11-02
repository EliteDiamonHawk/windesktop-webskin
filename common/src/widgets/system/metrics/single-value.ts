import { smallWidgetFrame } from "../../../frames/small-widget-frame.js";
import { classNames, maskedAsset } from "../../dom.js";

const ICON_ROOT = "/common/assets/icons/";
const SHAPE_ROOT = "/common/assets/shapes/";

const SCALAR_VALUE_PATTERN = /^([+-]?(?:\d[\d,]*(?:\.\d+)?|\.\d+))(\s*)(.*)$/;
const SCALAR_FALLBACK_PATTERN = /^(n\/a|-)(\s+)(.+)$/;

const nodeText = (node) => {
  if (!node) return "";
  if (node.children?.length) return [...node.children].map(nodeText).join("");
  return String(node.textContent ?? "");
};

const numericDigits = (value) => (value.match(/\d/g) ?? []).length;

const trimNumeric = (value, limit) => {
  if (numericDigits(value) <= limit) return value;
  const sign = /^[+-]/.test(value) ? value[0] : "";
  const unsigned = value.slice(sign.length).replace(/,/g, "");
  const [integer, fraction = ""] = unsigned.split(".");
  const digits = integer + fraction;
  const kept = digits.slice(0, limit);
  if (integer.length >= limit) return sign + kept;
  const keptFraction = kept.slice(integer.length);
  return sign + kept.slice(0, integer.length) + (keptFraction ? "." + keptFraction : "");
};

const normalizeUnit = (unit) => unit.replace(/\u00c2(?=°)/g, "");

const scalarTokens = (root, tokens = []) => {
  for (const child of root?.children ?? []) {
    if (child.dataset?.webskinSystemFormatPart) tokens.push(child);
    scalarTokens(child, tokens);
  }
  return tokens;
};

const rewriteTrailingText = (token, suffix) => {
  const parent = token?.parentNode;
  if (!parent) return;
  const children = parent.childNodes
    ? [...parent.childNodes]
    : [...(parent.children ?? [])];
  const index = children.indexOf(token);
  if (index < 0) return;
  const trailing = children.slice(index + 1);
  let written = false;
  for (const node of trailing) {
    if (node.dataset?.webskinSystemFormatPart) {
      node.textContent = "";
      continue;
    }
    if (node.nodeType === 1 || node.dataset) continue;
    node.textContent = written ? "" : suffix;
    written = true;
  }
};

const normalizeScalarDisplay = (renderRoot, subtext, label) => {
  const tokens = scalarTokens(renderRoot);
  const token = tokens[0];
  if (!token) return;

  const rendered = nodeText(renderRoot).trim();
  const tokenValue = nodeText(token).trim();
  const tokenUnit = tokens.length > 1 ? nodeText(tokens[1]).trim() : "";
  const match = tokens.length > 1
    ? (tokenValue.match(SCALAR_VALUE_PATTERN) ?? tokenValue.match(SCALAR_FALLBACK_PATTERN))
    : (rendered.match(SCALAR_VALUE_PATTERN) ?? rendered.match(SCALAR_FALLBACK_PATTERN));
  if (!match) {
    subtext.textContent = label;
    return;
  }

  const value = match[1];
  const separator = tokens.length > 1 ? " " : match[2];
  const unit = normalizeUnit(tokens.length > 1 ? tokenUnit : match[3].trim());
  const digits = numericDigits(value);
  const moveUnit = Boolean(unit) && (unit.length > 2 || digits > 6);
  const displayValue = trimNumeric(value, moveUnit || !unit ? 9 : 6);
  const tokenHasUnit = tokens.length === 1 && Boolean(nodeText(token).trim().match(SCALAR_VALUE_PATTERN)?.[3]?.trim());
  const inlineSuffix = unit && !moveUnit ? separator + unit : "";

  token.textContent = displayValue + (tokenHasUnit ? inlineSuffix : "");
  rewriteTrailingText(token, tokenHasUnit ? "" : inlineSuffix);
  subtext.textContent = moveUnit
    ? (label ? label + " " + unit : unit)
    : label;
};

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
    onRender: (renderRoot) => normalizeScalarDisplay(renderRoot, element.parts.subtext, String(label ?? "")),
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
