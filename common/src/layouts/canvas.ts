import type { CanvasPosition, LayoutDomOptions, LayoutInput, LayoutResult, LayoutWrapper, Padding } from "./types.js";
import { finite, innerBounds, normalizePadding, nonNegative, setResult, validateInput } from "./internal/geometry.js";
import { absoluteBaseStyles, childSizeStyles, paddingStyles, px } from "./internal/css.js";
import { createLayoutWrapper } from "./wrapper.js";

export type CanvasOptions = LayoutDomOptions & {
  padding?: Padding;
};

const coordinate = (value: number | undefined, fallback: number, name: string) => {
  if (value === undefined) return fallback;
  finite(value, name);
  return value;
};

const fraction = (value: number | undefined, name: string) => {
  if (value === undefined) return undefined;
  if (value < 0 || value > 1) throw new RangeError(`${name} must be between 0 and 1`);
  return value;
};

const calculatePosition = (position: CanvasPosition, bounds: ReturnType<typeof innerBounds>, width: number, height: number) => {
  const horizontal = [position.x, position.right, position.centerX, position.percentX].filter((value) => value !== undefined);
  const vertical = [position.y, position.bottom, position.centerY, position.percentY].filter((value) => value !== undefined);
  if (horizontal.length > 1) throw new RangeError("canvas position has conflicting horizontal anchors");
  if (vertical.length > 1) throw new RangeError("canvas position has conflicting vertical anchors");
  let x = bounds.x;
  let y = bounds.y;
  const percentX = fraction(position.percentX, "position.percentX");
  const percentY = fraction(position.percentY, "position.percentY");
  const anchorX = fraction(position.anchorX, "position.anchorX") ?? 0;
  const anchorY = fraction(position.anchorY, "position.anchorY") ?? 0;
  if (position.x !== undefined) x += coordinate(position.x, 0, "position.x");
  else if (position.right !== undefined) x += bounds.width - coordinate(position.right, 0, "position.right") - width;
  else if (position.centerX !== undefined) x += coordinate(position.centerX, 0, "position.centerX") - width / 2;
  else if (percentX !== undefined) x += percentX * bounds.width - anchorX * width;
  else x -= anchorX * width;
  if (position.y !== undefined) y += coordinate(position.y, 0, "position.y");
  else if (position.bottom !== undefined) y += bounds.height - coordinate(position.bottom, 0, "position.bottom") - height;
  else if (position.centerY !== undefined) y += coordinate(position.centerY, 0, "position.centerY") - height / 2;
  else if (percentY !== undefined) y += percentY * bounds.height - anchorY * height;
  else y -= anchorY * height;
  return { x, y };
};

export function createCanvas(options: CanvasOptions = {}): LayoutWrapper {
  return createLayoutWrapper("canvas", options, (input: LayoutInput): LayoutResult => {
    validateInput(input);
    const bounds = innerBounds(input, normalizePadding(options.padding));
    const result: LayoutResult = {};
    for (const child of input.children) {
      const position = child.position ?? {};
      const width = position.width ?? child.width;
      const height = position.height ?? child.height;
      nonNegative(width, `${child.id}.position.width`);
      nonNegative(height, `${child.id}.position.height`);
      const point = calculatePosition(position, bounds, width, height);
      setResult(result, child, { x: point.x, y: point.y, width, height, zIndex: position.zIndex ?? child.zIndex });
    }
    return result;
  }, {
    container: (layoutOptions) => ({
      position: "relative",
      ...paddingStyles(layoutOptions.padding),
    }),
    child: (childOptions) => {
      const position = childOptions.position ?? {};
      const transformX = position.centerX !== undefined ? "-50%" : position.percentX !== undefined ? `${-(position.anchorX ?? 0) * 100}%` : undefined;
      const transformY = position.centerY !== undefined ? "-50%" : position.percentY !== undefined ? `${-(position.anchorY ?? 0) * 100}%` : undefined;
      const transform = transformX !== undefined || transformY !== undefined
        ? `translate(${transformX ?? "0%"}, ${transformY ?? "0%"})`
        : undefined;
      return {
        ...absoluteBaseStyles(childOptions),
        ...childSizeStyles(childOptions),
        width: px(position.width) ?? px(childOptions.width),
        height: px(position.height) ?? px(childOptions.height),
        left: position.x !== undefined ? px(position.x) : position.right !== undefined ? undefined : position.centerX !== undefined ? px(position.centerX) : position.percentX === undefined ? px(position.anchorX ? 0 : 0) : `${position.percentX * 100}%`,
        right: position.right === undefined ? undefined : px(position.right),
        top: position.y !== undefined ? px(position.y) : position.bottom !== undefined ? undefined : position.centerY !== undefined ? px(position.centerY) : position.percentY === undefined ? px(position.anchorY ? 0 : 0) : `${position.percentY * 100}%`,
        bottom: position.bottom === undefined ? undefined : px(position.bottom),
        transform,
        zIndex: position.zIndex ?? childOptions.zIndex,
      };
    },
  });
}

