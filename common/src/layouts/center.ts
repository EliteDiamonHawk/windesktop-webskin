import type { LayoutDescriptor, LayoutInput, LayoutResult, Padding } from "./types.js";
import { alignOffset, constrainedSize, createDescriptor, innerBounds, normalizePadding, setResult, validateInput } from "./internal/geometry.js";

export type CenterOptions = {
  axis?: "horizontal" | "vertical" | "both";
  padding?: Padding;
};

export function createCenter(options: CenterOptions = {}): LayoutDescriptor {
  return createDescriptor("center", (input: LayoutInput): LayoutResult => {
    validateInput(input);
    const bounds = innerBounds(input, normalizePadding(options.padding));
    const axis = options.axis ?? "both";
    const result: LayoutResult = {};
    for (const child of input.children) {
      const size = constrainedSize(child, child.width, child.height);
      const centerX = axis === "vertical" ? bounds.x : bounds.x + alignOffset(bounds.width, size.width, "center");
      const centerY = axis === "horizontal" ? bounds.y : bounds.y + alignOffset(bounds.height, size.height, "center");
      setResult(result, child, { x: centerX, y: centerY, width: size.width, height: size.height, zIndex: child.zIndex });
    }
    return result;
  });
}

