import type { LayoutDomOptions, LayoutInput, LayoutResult, LayoutWrapper, Padding } from "./types.js";
import { alignOffset, constrainedSize, innerBounds, normalizePadding, setResult, validateInput } from "./internal/geometry.js";
import { absoluteBaseStyles, paddingStyles, px } from "./internal/css.js";
import { createLayoutWrapper } from "./wrapper.js";

export type CenterOptions = LayoutDomOptions & {
  axis?: "horizontal" | "vertical" | "both";
  padding?: Padding;
};

export function createCenter(options: CenterOptions = {}): LayoutWrapper {
  return createLayoutWrapper("center", options, (input: LayoutInput): LayoutResult => {
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
  }, {
    container: (layoutOptions) => ({
      position: "relative",
      ...paddingStyles(layoutOptions.padding),
    }),
    child: (childOptions) => ({
      ...absoluteBaseStyles(childOptions),
      left: childOptions.offsetX === undefined ? undefined : px(childOptions.offsetX),
      top: childOptions.offsetY === undefined ? undefined : px(childOptions.offsetY),
    }),
  });
}

