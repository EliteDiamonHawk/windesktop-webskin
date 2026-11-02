import type { LayoutDomOptions, LayoutInput, LayoutResult, LayoutWrapper, OverlayPlacement, Padding } from "./types.js";
import { alignOffset, constrainedSize, innerBounds, normalizePadding, setResult, validateInput } from "./internal/geometry.js";
import { childSizeStyles, paddingStyles, px } from "./internal/css.js";
import { createLayoutWrapper } from "./wrapper.js";

export type OverlayOptions = LayoutDomOptions & {
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

export function createOverlay(options: OverlayOptions = {}): LayoutWrapper {
  return createLayoutWrapper("overlay", options, (input: LayoutInput): LayoutResult => {
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
  }, {
    container: (layoutOptions) => ({
      display: "grid",
      ...paddingStyles(layoutOptions.padding),
    }),
    child: (childOptions, index, id) => {
      const primary = options.primaryId === undefined ? index === 0 : id === options.primaryId;
      const placement = childOptions.overlay ?? options.position ?? "top-right";
      const horizontal = placement === "left" || placement.endsWith("left") ? "start" : placement === "right" || placement.endsWith("right") ? "end" : "center";
      const vertical = placement === "top" || placement.startsWith("top") ? "start" : placement === "bottom" || placement.startsWith("bottom") ? "end" : "center";
      return {
        ...childSizeStyles(childOptions),
        gridArea: "1 / 1",
        justifySelf: primary ? "stretch" : horizontal,
        alignSelf: primary ? "stretch" : vertical,
        transform: primary ? undefined : `translate(${px(childOptions.offsetX ?? 0) ?? "0px"}, ${px(childOptions.offsetY ?? 0) ?? "0px"})`,
      };
    },
  });
}

