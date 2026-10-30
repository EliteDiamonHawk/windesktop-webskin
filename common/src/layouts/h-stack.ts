import type { Alignment, Distribution, Padding, LayoutDescriptor } from "./types.js";
import { createLinearDescriptor } from "./internal/linear.js";

export type HStackOptions = {
  gap?: number;
  distribution?: Distribution;
  align?: Alignment;
  wrap?: boolean;
  padding?: Padding;
  childSizing?: "natural" | "stretch";
};

export function createHStack(options: HStackOptions = {}): LayoutDescriptor {
  return createLinearDescriptor("h-stack", { axis: "horizontal", ...options });
}

