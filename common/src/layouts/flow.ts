import type { Alignment, Axis, Distribution, LayoutDomOptions, Padding, LayoutWrapper } from "./types.js";
import { createLinearDescriptor } from "./internal/linear.js";

export type FlowOptions = LayoutDomOptions & {
  direction?: Axis;
  gap?: number;
  distribution?: Distribution;
  align?: Alignment;
  padding?: Padding;
  maxLineSize?: number;
};

export function createFlow(options: FlowOptions = {}): LayoutWrapper {
  const direction = options.direction ?? "horizontal";
  const maxLineSize = options.maxLineSize;
  return createLinearDescriptor("flow", {
    axis: direction,
    gap: options.gap,
    distribution: options.distribution,
    align: options.align,
    padding: options.padding,
    wrap: true,
    childSizing: "natural",
    maxLineSize,
  });
}

