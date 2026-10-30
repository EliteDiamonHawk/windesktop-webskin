import type { LayoutDescriptor, LayoutInput, LayoutResult } from "./types.js";
import { createDescriptor, nonNegative, validateInput } from "./internal/geometry.js";

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

export type ResponsiveOptions = {
  rules: readonly ResponsiveRule[];
  fallback: LayoutDescriptor;
};

const matches = (size: number, minimum: number | undefined, maximum: number | undefined, name: string) => {
  if (minimum !== undefined) nonNegative(minimum, `${name}.min`);
  if (maximum !== undefined) nonNegative(maximum, `${name}.max`);
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) throw new RangeError(`${name}.min cannot exceed max`);
  return (minimum === undefined || size >= minimum) && (maximum === undefined || size <= maximum);
};

export function createResponsive(options: ResponsiveOptions): LayoutDescriptor {
  if (!options || !Array.isArray(options.rules)) throw new TypeError("responsive rules must be an array");
  if (!options.fallback || typeof options.fallback.calculate !== "function") throw new TypeError("responsive fallback is required");
  return createDescriptor("responsive", (input: LayoutInput): LayoutResult => {
    validateInput(input);
    const selected = options.rules.find((rule, index) => {
      if (!rule || typeof rule.layout?.calculate !== "function") throw new TypeError(`responsive rule ${index} is invalid`);
      const when = rule.when ?? {};
      return matches(input.width, when.minWidth, when.maxWidth, `rules[${index}].width`)
        && matches(input.height, when.minHeight, when.maxHeight, `rules[${index}].height`);
    });
    return (selected?.layout ?? options.fallback).calculate(input);
  });
}

