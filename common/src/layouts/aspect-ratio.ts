import type { LayoutDomOptions, LayoutInput, LayoutResult, LayoutWrapper, Padding } from "./types.js";
import { alignOffset, constrainedSize, innerBounds, normalizePadding, positive, setResult, validateInput } from "./internal/geometry.js";
import { absoluteBaseStyles, paddingStyles, px } from "./internal/css.js";
import { createLayoutWrapper } from "./wrapper.js";

export type AspectRatioOptions = LayoutDomOptions & {
  ratio: number;
  fit?: "contain" | "cover" | "width" | "height" | "manual";
  padding?: Padding;
  horizontalAlign?: "start" | "center" | "end";
  verticalAlign?: "start" | "center" | "end";
};

export function createAspectRatio(options: AspectRatioOptions): LayoutWrapper {
  positive(options.ratio, "ratio");
  return createLayoutWrapper("aspect-ratio", options, (input: LayoutInput): LayoutResult => {
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
  }, {
    container: (layoutOptions) => ({
      position: "relative",
      ...paddingStyles(layoutOptions.padding),
    }),
    child: (childOptions) => {
      const fit = options.fit ?? "contain";
      const alignment = `${options.horizontalAlign ?? "center"} ${options.verticalAlign ?? "center"}`;
      return {
        ...absoluteBaseStyles(childOptions),
        aspectRatio: String(options.ratio),
        inset: alignment === "center center" ? "0" : undefined,
        margin: alignment === "center center" ? "auto" : undefined,
        width: fit === "height" ? "auto" : fit === "cover" ? "100%" : px(childOptions.width) ?? "100%",
        height: fit === "width" ? "auto" : fit === "cover" ? "100%" : px(childOptions.height) ?? "auto",
        maxWidth: fit === "cover" ? undefined : "100%",
        maxHeight: fit === "cover" ? undefined : "100%",
        justifySelf: options.horizontalAlign === "end" ? "end" : options.horizontalAlign === "start" ? "start" : "center",
        alignSelf: options.verticalAlign === "end" ? "end" : options.verticalAlign === "start" ? "start" : "center",
      };
    },
  });
}

