import type { Alignment, Distribution, Padding, LayoutDescriptor } from "./types.js";
import { createLinearDescriptor } from "./internal/linear.js";

export type VStackOptions = {
  gap?: number;
  distribution?: Distribution;
  align?: Alignment;
  wrap?: boolean;
  padding?: Padding;
  childSizing?: "natural" | "stretch";
};

export function createVStack(options: VStackOptions = {}): LayoutDescriptor {
  return createLinearDescriptor("v-stack", { axis: "vertical", ...options });
}

