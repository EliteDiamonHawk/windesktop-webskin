import type { Alignment, LayoutDescriptor, LayoutInput, LayoutResult, Padding } from "./types.js";
import {
  alignOffset,
  constrainedSize,
  createDescriptor,
  innerBounds,
  normalizePadding,
  nonNegative,
  setResult,
  validateInput,
} from "./internal/geometry.js";

export type ZStackOptions = {
  horizontalAlign?: "start" | "center" | "end" | "stretch";
  verticalAlign?: "start" | "center" | "end" | "stretch";
  padding?: Padding;
  sizing?: "natural" | "stretch";
  offsetX?: number;
  offsetY?: number;
};

const calculate = (input: LayoutInput, options: ZStackOptions): LayoutResult => {
  validateInput(input);
  const padding = normalizePadding(options.padding);
  const bounds = innerBounds(input, padding);
  const offsetX = options.offsetX ?? 0;
  const offsetY = options.offsetY ?? 0;
  nonNegative(Math.abs(offsetX), "offsetX");
  nonNegative(Math.abs(offsetY), "offsetY");
  const result: LayoutResult = {};

  for (const child of input.children) {
    const width = options.sizing === "stretch" || options.horizontalAlign === "stretch" ? bounds.width : child.width;
    const height = options.sizing === "stretch" || options.verticalAlign === "stretch" ? bounds.height : child.height;
    const size = constrainedSize(child, width, height);
    setResult(result, child, {
      x: bounds.x + alignOffset(bounds.width, size.width, options.horizontalAlign ?? "center") + offsetX + (child.offsetX ?? 0),
      y: bounds.y + alignOffset(bounds.height, size.height, options.verticalAlign ?? "center") + offsetY + (child.offsetY ?? 0),
      width: size.width,
      height: size.height,
      zIndex: child.zIndex,
    });
  }
  return result;
};

export function createZStack(options: ZStackOptions = {}): LayoutDescriptor {
  return createDescriptor("z-stack", (input) => calculate(input, options));
}

