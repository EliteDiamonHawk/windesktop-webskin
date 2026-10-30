import type { LayoutDescriptor, LayoutInput, LayoutResult, OverlayPlacement, Padding } from "./types.js";
import { alignOffset, constrainedSize, createDescriptor, innerBounds, normalizePadding, setResult, validateInput } from "./internal/geometry.js";

export type OverlayOptions = {
  primaryId?: string;
  position?: OverlayPlacement;
  padding?: Padding;
};

const position = (placement: OverlayPlacement, width: number, height: number, childWidth: number, childHeight: number) => {
  const horizontal = placement === "left" || placement.endsWith("left")
    ? 0
    : placement === "right" || placement.endsWith("right")
      ? width - childWidth
      : alignOffset(width, childWidth, "center");
  const vertical = placement === "top" || placement.startsWith("top")
    ? 0
    : placement === "bottom" || placement.startsWith("bottom")
      ? height - childHeight
      : alignOffset(height, childHeight, "center");
  return { x: horizontal, y: vertical };
};

export function createOverlay(options: OverlayOptions = {}): LayoutDescriptor {
  return createDescriptor("overlay", (input: LayoutInput): LayoutResult => {
    validateInput(input);
    const bounds = innerBounds(input, normalizePadding(options.padding));
    const primary = input.children.find((child) => child.id === options.primaryId) ?? input.children[0];
    const result: LayoutResult = {};
    if (!primary) return result;
    const primarySize = constrainedSize(primary, primary.width, primary.height);
    setResult(result, primary, { x: bounds.x, y: bounds.y, width: primarySize.width, height: primarySize.height, zIndex: primary.zIndex });
    for (const child of input.children) {
      if (child === primary) continue;
      const size = constrainedSize(child, child.width, child.height);
      const point = position(child.overlay ?? options.position ?? "top-right", primarySize.width, primarySize.height, size.width, size.height);
      setResult(result, child, {
        x: bounds.x + point.x + (child.offsetX ?? 0),
        y: bounds.y + point.y + (child.offsetY ?? 0),
        width: size.width,
        height: size.height,
        zIndex: child.zIndex,
      });
    }
    return result;
  });
}

