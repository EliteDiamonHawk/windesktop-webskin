import type { Alignment, Distribution, Padding, LayoutDomOptions, LayoutWrapper } from "./types.js";
import { createLinearDescriptor } from "./internal/linear.js";

export type HStackOptions = LayoutDomOptions & {
  gap?: number;
  distribution?: Distribution;
  align?: Alignment;
  wrap?: boolean;
  padding?: Padding;
  childSizing?: "natural" | "stretch";
};

export function createHStack(options: HStackOptions = {}): LayoutWrapper {
  return createLinearDescriptor("h-stack", { axis: "horizontal", ...options });
}

