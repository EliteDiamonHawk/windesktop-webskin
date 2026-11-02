import type { Alignment, Distribution, Padding, LayoutDomOptions, LayoutWrapper } from "./types.js";
import { createLinearDescriptor } from "./internal/linear.js";

export type VStackOptions = LayoutDomOptions & {
  gap?: number;
  distribution?: Distribution;
  align?: Alignment;
  wrap?: boolean;
  padding?: Padding;
  childSizing?: "natural" | "stretch";
};

export function createVStack(options: VStackOptions = {}): LayoutWrapper {
  return createLinearDescriptor("v-stack", { axis: "vertical", ...options });
}

