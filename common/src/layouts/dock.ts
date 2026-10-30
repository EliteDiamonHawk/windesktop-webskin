import type { DockRegion, LayoutDescriptor, LayoutInput, LayoutResult, Padding } from "./types.js";
import { createDescriptor, innerBounds, normalizePadding, nonNegative, setResult, validateInput } from "./internal/geometry.js";

export type DockOptions = {
  padding?: Padding;
  gap?: number;
  defaultRegion?: DockRegion;
};

export function createDock(options: DockOptions = {}): LayoutDescriptor {
  return createDescriptor("dock", (input: LayoutInput): LayoutResult => {
    validateInput(input);
    const bounds = innerBounds(input, normalizePadding(options.padding));
    const gap = nonNegative(options.gap ?? 0, "gap");
    let left = bounds.x;
    let top = bounds.y;
    let right = bounds.x + bounds.width;
    let bottom = bounds.y + bounds.height;
    const result: LayoutResult = {};
    const regionOf = (child: typeof input.children[number]) => child.dock ?? options.defaultRegion ?? "fill";
    const place = (child: typeof input.children[number], region: DockRegion) => {
      if (region === "top") {
        const height = child.height;
        setResult(result, child, { x: left, y: top, width: Math.max(0, right - left), height, zIndex: child.zIndex });
        top += height + gap;
      } else if (region === "bottom") {
        const height = child.height;
        bottom -= height;
        setResult(result, child, { x: left, y: bottom, width: Math.max(0, right - left), height, zIndex: child.zIndex });
        bottom -= gap;
      } else if (region === "left") {
        const width = child.width;
        setResult(result, child, { x: left, y: top, width, height: Math.max(0, bottom - top), zIndex: child.zIndex });
        left += width + gap;
      } else if (region === "right") {
        const width = child.width;
        right -= width;
        setResult(result, child, { x: right, y: top, width, height: Math.max(0, bottom - top), zIndex: child.zIndex });
        right -= gap;
      } else {
        setResult(result, child, { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top), zIndex: child.zIndex });
      }
    };
    for (const region of ["top", "bottom", "left", "right", "fill"] as DockRegion[]) {
      for (const child of input.children) if (regionOf(child) === region) place(child, region);
    }
    return result;
  });
}

