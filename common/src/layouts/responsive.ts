import type { LayoutDomOptions, LayoutDescriptor, LayoutInput, LayoutResult, LayoutWrapper } from "./types.js";
import { nonNegative, validateInput } from "./internal/geometry.js";
import { layoutStyleProvider, createLayoutWrapper } from "./wrapper.js";

export type ResponsiveBounds = {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
};

export type ResponsiveRule = {
  when: ResponsiveBounds;
  layout: LayoutDescriptor;
};

export type ResponsiveOptions = LayoutDomOptions & {
  rules: readonly ResponsiveRule[];
  fallback: LayoutDescriptor;
};

const matches = (size: number, minimum: number | undefined, maximum: number | undefined, name: string) => {
  if (minimum !== undefined) nonNegative(minimum, `${name}.min`);
  if (maximum !== undefined) nonNegative(maximum, `${name}.max`);
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) throw new RangeError(`${name}.min cannot exceed max`);
  return (minimum === undefined || size >= minimum) && (maximum === undefined || size <= maximum);
};

const cssName = (property: string) => property.startsWith("--")
  ? property
  : property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const cssValue = (value: string | number | undefined | null) => value === undefined || value === null ? undefined : String(value);

const escaped = (value: string) => value
  .replace(/\\/g, "\\\\")
  .replace(/"/g, '\\"')
  .replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);

const condition = (when: ResponsiveBounds) => [
  when.minWidth === undefined ? undefined : `(min-width: ${when.minWidth}px)`,
  when.maxWidth === undefined ? undefined : `(max-width: ${when.maxWidth}px)`,
  when.minHeight === undefined ? undefined : `(min-height: ${when.minHeight}px)`,
  when.maxHeight === undefined ? undefined : `(max-height: ${when.maxHeight}px)`,
].filter(Boolean).join(" and ") || "(min-width: 0px)";

const ruleText = (selector: string, styles: Record<string, string | number | undefined | null>) => {
  const declarations = Object.entries(styles)
    .map(([property, value]) => {
      const resolved = cssValue(value);
      return resolved === undefined ? undefined : `${cssName(property)}: ${resolved} !important;`;
    })
    .filter(Boolean)
    .join(" ");
  return declarations ? `${selector} { ${declarations} }` : "";
};

let responsiveId = 0;

export function createResponsive(options: ResponsiveOptions): LayoutWrapper {
  if (!options || !Array.isArray(options.rules)) throw new TypeError("responsive rules must be an array");
  if (!options.fallback || typeof options.fallback.calculate !== "function") throw new TypeError("responsive fallback is required");
  const fallbackProvider = layoutStyleProvider(options.fallback);
  let styleElement: HTMLStyleElement | undefined;
  const scope = `responsive-${++responsiveId}`;
  const wrapper = createLayoutWrapper("responsive", options, (input: LayoutInput): LayoutResult => {
    validateInput(input);
    const selected = options.rules.find((rule, index) => {
      if (!rule || typeof rule.layout?.calculate !== "function") throw new TypeError(`responsive rule ${index} is invalid`);
      const when = rule.when ?? {};
      return matches(input.width, when.minWidth, when.maxWidth, `rules[${index}].width`)
        && matches(input.height, when.minHeight, when.maxHeight, `rules[${index}].height`);
    });
    return (selected?.layout ?? options.fallback).calculate(input);
  }, {
    outer: () => ({ containerType: "inline-size" }),
    container: () => fallbackProvider?.getContainerStyles() ?? {},
    child: (childOptions, index, id) => fallbackProvider?.getChildStyles(childOptions, index, id) ?? {},
    content: true,
    onApply: (element, currentWrapper) => {
      element.dataset.webskinResponsive = scope;
      if (typeof document === "undefined") return;
      if (!styleElement) {
        styleElement = document.createElement("style");
        styleElement.dataset.webskinResponsiveStyle = scope;
        (document.head ?? document.documentElement ?? element).append(styleElement);
      }
      const rules = options.rules.map((rule, index) => {
        const provider = layoutStyleProvider(rule.layout);
        if (!provider) return "";
        const parentSelector = `[data-webskin-responsive="${scope}"] > [data-webskin-layout-content="responsive"]`;
        const childIds = Array.from(currentWrapper.children().keys());
        const childRules = childIds.map((id, childIndex) => {
          const childOptions = currentWrapper.getChildOptions(id) ?? {};
          return ruleText(`${parentSelector} > [data-webskin-layout-child="${escaped(id)}"]`, provider.getChildStyles(childOptions, childIndex, id));
        }).join(" ");
        const text = [
          ruleText(parentSelector, provider.getContainerStyles()),
          childRules,
        ].filter(Boolean).join(" ");
        return text ? `@container ${condition(rule.when ?? {})} { ${text} }` : `/* responsive rule ${index} has no CSS state */`;
      }).join(" ");
      styleElement.textContent = rules;
    },
    onDispose: () => {
      styleElement?.remove();
      styleElement = undefined;
    },
  });
  return wrapper;
}

