import type { Alignment, LayoutDomOptions, LayoutInput, LayoutResult, LayoutWrapper, Padding } from "./types.js";
import {
  alignOffset,
  constrainedSize,
  innerBounds,
  normalizePadding,
  nonNegative,
  setResult,
  validateInput,
} from "./internal/geometry.js";
import { absoluteBaseStyles, paddingStyles, px } from "./internal/css.js";
import { createLayoutWrapper } from "./wrapper.js";

export type ZStackOptions = LayoutDomOptions & {
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

export function createZStack(options: ZStackOptions = {}): LayoutWrapper {
  return createLayoutWrapper("z-stack", options, (input) => calculate(input, options), {
    container: (layoutOptions) => ({
      position: "relative",
      ...paddingStyles(layoutOptions.padding),
    }),
    child: (childOptions) => {
      const horizontal = options.horizontalAlign ?? "center";
      const vertical = options.verticalAlign ?? "center";
      const stretch = options.sizing === "stretch" || horizontal === "stretch" || vertical === "stretch";
      const transformX = horizontal === "center" ? "-50%" : horizontal === "end" ? "-100%" : "0";
      const transformY = vertical === "center" ? "-50%" : vertical === "end" ? "-100%" : "0";
      return {
        ...absoluteBaseStyles(childOptions),
        left: stretch || horizontal === "start" ? px(childOptions.offsetX ?? 0) : "50%",
        top: stretch || vertical === "start" ? px(childOptions.offsetY ?? 0) : "50%",
        right: stretch && horizontal !== "start" ? px(0) : undefined,
        bottom: stretch && vertical !== "start" ? px(0) : undefined,
        width: stretch ? "auto" : px(childOptions.width),
        height: stretch ? "auto" : px(childOptions.height),
        transform: `translate(${transformX}, ${transformY}) translate(${px(childOptions.offsetX ?? 0) ?? "0px"}, ${px(childOptions.offsetY ?? 0) ?? "0px"})`,
      };
    },
  });
}

