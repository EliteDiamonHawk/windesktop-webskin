import type {
  Geometry,
  LayoutChild,
  LayoutDescriptor,
  LayoutInput,
  LayoutResult,
  Padding,
  Size,
} from "../types.js";

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PaddingValues = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const finite = (value: unknown, name: string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite`);
  }
  return value;
};

export const nonNegative = (value: unknown, name: string) => {
  finite(value, name);
  if (value < 0) throw new RangeError(`${name} must be non-negative`);
  return value;
};

export const positive = (value: unknown, name: string) => {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be greater than 0`);
  return value;
};

export const integer = (value: unknown, name: string, minimum = 0) => {
  if (!Number.isInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be an integer greater than or equal to ${minimum}`);
  }
  return value as number;
};

export const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(Math.max(value, minimum), maximum)
);

export const normalizePadding = (padding: Padding = 0): PaddingValues => {
  if (typeof padding === "number") {
    nonNegative(padding, "padding");
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  if (!padding || typeof padding !== "object") throw new TypeError("padding must be a number or object");
  return {
    top: nonNegative(padding.top ?? 0, "padding.top"),
    right: nonNegative(padding.right ?? 0, "padding.right"),
    bottom: nonNegative(padding.bottom ?? 0, "padding.bottom"),
    left: nonNegative(padding.left ?? 0, "padding.left"),
  };
};

export const validateInput = (input: LayoutInput): LayoutInput => {
  if (!input || typeof input !== "object") throw new TypeError("layout input is required");
  nonNegative(input.width, "width");
  nonNegative(input.height, "height");
  if (!Array.isArray(input.children)) throw new TypeError("children must be an array");

  const ids = new Set<string>();
  for (const [index, child] of input.children.entries()) {
    if (!child || typeof child !== "object") throw new TypeError(`children[${index}] must be an object`);
    if (typeof child.id !== "string" || child.id.length === 0) {
      throw new TypeError(`children[${index}].id must be a non-empty string`);
    }
    if (ids.has(child.id)) throw new RangeError(`children contains duplicate id: ${child.id}`);
    ids.add(child.id);
    nonNegative(child.width, `children[${index}].width`);
    nonNegative(child.height, `children[${index}].height`);
    for (const [name, value] of [
      ["minWidth", child.minWidth],
      ["maxWidth", child.maxWidth],
      ["minHeight", child.minHeight],
      ["maxHeight", child.maxHeight],
    ] as const) {
      if (value !== undefined) nonNegative(value, `children[${index}].${name}`);
    }
    if (child.minWidth !== undefined && child.maxWidth !== undefined && child.minWidth > child.maxWidth) {
      throw new RangeError(`children[${index}].minWidth cannot exceed maxWidth`);
    }
    if (child.minHeight !== undefined && child.maxHeight !== undefined && child.minHeight > child.maxHeight) {
      throw new RangeError(`children[${index}].minHeight cannot exceed maxHeight`);
    }
    if (child.flex !== undefined) nonNegative(child.flex, `children[${index}].flex`);
    if (child.x !== undefined) finite(child.x, `children[${index}].x`);
    if (child.y !== undefined) finite(child.y, `children[${index}].y`);
  }
  return input;
};

export const createDescriptor = (
  type: string,
  calculate: (input: LayoutInput) => LayoutResult,
): LayoutDescriptor => Object.freeze({ type, calculate });

export const innerBounds = (input: Size, padding: PaddingValues): Bounds => ({
  x: padding.left,
  y: padding.top,
  width: Math.max(0, input.width - padding.left - padding.right),
  height: Math.max(0, input.height - padding.top - padding.bottom),
});

export const constrainedSize = (child: LayoutChild, width: number, height: number): Size => ({
  width: clamp(width, child.minWidth ?? 0, child.maxWidth ?? Number.POSITIVE_INFINITY),
  height: clamp(height, child.minHeight ?? 0, child.maxHeight ?? Number.POSITIVE_INFINITY),
});

export const alignOffset = (
  available: number,
  size: number,
  alignment: "start" | "center" | "end" | "stretch" = "start",
) => {
  if (alignment === "center") return (available - size) / 2;
  if (alignment === "end") return available - size;
  return 0;
};

export const setResult = (
  result: LayoutResult,
  child: LayoutChild,
  geometry: Geometry,
) => {
  result[child.id] = {
    x: geometry.x,
    y: geometry.y,
    width: Math.max(0, geometry.width),
    height: Math.max(0, geometry.height),
    ...(geometry.zIndex === undefined ? {} : { zIndex: geometry.zIndex }),
  };
};

export const childGeometry = (child: LayoutChild): Geometry => ({
  x: child.x ?? 0,
  y: child.y ?? 0,
  width: child.width,
  height: child.height,
  ...(child.zIndex === undefined ? {} : { zIndex: child.zIndex }),
});

export const childById = (children: readonly LayoutChild[]) => new Map(children.map((child) => [child.id, child]));

