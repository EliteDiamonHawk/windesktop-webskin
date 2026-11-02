import type { Axis, LayoutDomOptions, LayoutInput, LayoutResult, LayoutWrapper, Padding } from "./types.js";
import {
  innerBounds,
  normalizePadding,
  nonNegative,
  setResult,
  validateInput,
} from "./internal/geometry.js";
import { childSizeStyles, paddingStyles, px } from "./internal/css.js";
import { createLayoutWrapper } from "./wrapper.js";

export type SplitRegion = {
  id?: string;
  size?: number;
  ratio?: number;
};

export type SplitOptions = LayoutDomOptions & {
  direction?: Axis;
  regions?: readonly SplitRegion[];
  gap?: number;
  padding?: Padding;
};

const calculate = (input: LayoutInput, options: SplitOptions): LayoutResult => {
  validateInput(input);
  const padding = normalizePadding(options.padding);
  const bounds = innerBounds(input, padding);
  const direction = options.direction ?? "horizontal";
  const gap = nonNegative(options.gap ?? 0, "gap");
  const available = (direction === "horizontal" ? bounds.width : bounds.height) - Math.max(0, input.children.length - 1) * gap;
  const regions = input.children.map((child, index) => options.regions?.[index] ?? { ratio: 1 });
  const fixed = regions.reduce((sum, region) => sum + (region.size ?? 0), 0);
  const ratioTotal = regions.reduce((sum, region) => sum + (region.size === undefined ? Math.max(0, region.ratio ?? 0) : 0), 0);
  const remaining = Math.max(0, available - fixed);
  const sizes = regions.map((region) => region.size ?? (ratioTotal > 0 ? remaining * Math.max(0, region.ratio ?? 0) / ratioTotal : 0));
  const result: LayoutResult = {};
  let cursor = direction === "horizontal" ? bounds.x : bounds.y;
  for (const [index, child] of input.children.entries()) {
    const size = sizes[index];
    setResult(result, child, direction === "horizontal"
      ? { x: cursor, y: bounds.y, width: size, height: bounds.height, zIndex: child.zIndex }
      : { x: bounds.x, y: cursor, width: bounds.width, height: size, zIndex: child.zIndex });
    cursor += size + gap;
  }
  return result;
};

export function createSplit(options: SplitOptions = {}): LayoutWrapper {
  return createLayoutWrapper("split", options, (input) => calculate(input, options), {
    container: (layoutOptions) => ({
      display: "flex",
      flexDirection: layoutOptions.direction === "vertical" ? "column" : "row",
      gap: px(layoutOptions.gap ?? 0),
      ...paddingStyles(layoutOptions.padding),
    }),
    child: (childOptions, index) => {
      const region = options.regions?.[index] ?? { ratio: 1 };
      const basis = region.size === undefined ? "0%" : `${region.size}px`;
      const grow = region.size === undefined ? Math.max(0, region.ratio ?? 0) : 0;
      return {
        ...childSizeStyles(childOptions),
        flex: `${grow} 1 ${basis}`,
      };
    },
  });
}

