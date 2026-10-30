import type { LayoutDescriptor, LayoutInput, LayoutResult, Padding } from "./types.js";
import { alignOffset, constrainedSize, createDescriptor, innerBounds, normalizePadding, positive, setResult, validateInput } from "./internal/geometry.js";

export type AspectRatioOptions = {
  ratio: number;
  fit?: "contain" | "cover" | "width" | "height" | "manual";
  padding?: Padding;
  horizontalAlign?: "start" | "center" | "end";
  verticalAlign?: "start" | "center" | "end";
};

export function createAspectRatio(options: AspectRatioOptions): LayoutDescriptor {
  positive(options.ratio, "ratio");
  return createDescriptor("aspect-ratio", (input: LayoutInput): LayoutResult => {
    validateInput(input);
    const bounds = innerBounds(input, normalizePadding(options.padding));
    const result: LayoutResult = {};
    for (const child of input.children) {
      const fit = options.fit ?? "contain";
      let width = child.width;
      let height = child.height;
      if (fit === "contain") {
        width = Math.min(bounds.width, bounds.height * options.ratio);
        height = width / options.ratio;
      } else if (fit === "cover") {
        width = Math.max(bounds.width, bounds.height * options.ratio);
        height = width / options.ratio;
        if (height < bounds.height) {
          height = bounds.height;
          width = height * options.ratio;
        }
      } else if (fit === "width") {
        width = bounds.width;
        height = width / options.ratio;
      } else if (fit === "height") {
        height = bounds.height;
        width = height * options.ratio;
      }
      const size = constrainedSize(child, width, height);
      setResult(result, child, {
        x: bounds.x + alignOffset(bounds.width, size.width, options.horizontalAlign ?? "center"),
        y: bounds.y + alignOffset(bounds.height, size.height, options.verticalAlign ?? "center"),
        width: size.width,
        height: size.height,
        zIndex: child.zIndex,
      });
    }
    return result;
  });
}

