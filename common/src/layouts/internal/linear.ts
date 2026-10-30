import type {
  Alignment,
  Axis,
  Distribution,
  LayoutChild,
  LayoutInput,
  LayoutResult,
  Padding,
} from "../types.js";
import {
  alignOffset,
  constrainedSize,
  createDescriptor,
  innerBounds,
  normalizePadding,
  nonNegative,
  setResult,
  validateInput,
} from "./geometry.js";

export type LinearOptions = {
  axis: Axis;
  gap?: number;
  distribution?: Distribution;
  align?: Alignment;
  wrap?: boolean;
  padding?: Padding;
  childSizing?: "natural" | "stretch";
  maxLineSize?: number;
};

type Line = {
  children: LayoutChild[];
  main: number;
  cross: number;
};

const mainSize = (child: LayoutChild, axis: Axis) => axis === "horizontal" ? child.width : child.height;
const crossSize = (child: LayoutChild, axis: Axis) => axis === "horizontal" ? child.height : child.width;

const makeLines = (children: readonly LayoutChild[], axis: Axis, available: number, gap: number, wrap: boolean) => {
  const lines: Line[] = [];
  let line: Line = { children: [], main: 0, cross: 0 };
  for (const child of children) {
    const size = mainSize(child, axis);
    const next = line.children.length === 0 ? size : line.main + gap + size;
    if (wrap && line.children.length > 0 && next > available) {
      lines.push(line);
      line = { children: [], main: 0, cross: 0 };
    }
    line.children.push(child);
    line.main += line.children.length === 1 ? size : gap + size;
    line.cross = Math.max(line.cross, crossSize(child, axis));
  }
  if (line.children.length > 0) lines.push(line);
  return lines;
};

const distributionValues = (distribution: Distribution, free: number, count: number) => {
  const positiveFree = Math.max(0, free);
  if (distribution === "space-between" && count > 1) return { before: 0, extra: positiveFree / (count - 1) };
  if (distribution === "space-around" && count > 0) return { before: positiveFree / (count * 2), extra: positiveFree / count };
  if (distribution === "space-evenly" && count > 0) return { before: positiveFree / (count + 1), extra: positiveFree / (count + 1) };
  if (distribution === "center") return { before: positiveFree / 2, extra: 0 };
  if (distribution === "end") return { before: positiveFree, extra: 0 };
  return { before: 0, extra: 0 };
};

export const calculateLinear = (input: LayoutInput, options: LinearOptions): LayoutResult => {
  validateInput(input);
  const gap = nonNegative(options.gap ?? 0, "gap");
  const padding = normalizePadding(options.padding);
  const bounds = innerBounds(input, padding);
  const axis = options.axis;
  const availableMain = axis === "horizontal" ? bounds.width : bounds.height;
  const lineLimit = options.maxLineSize === undefined
    ? availableMain
    : Math.min(availableMain, nonNegative(options.maxLineSize, "maxLineSize"));
  const availableCross = axis === "horizontal" ? bounds.height : bounds.width;
  const lines = makeLines(input.children, axis, lineLimit, gap, options.wrap ?? false);
  const result: LayoutResult = {};
  let crossCursor = axis === "horizontal" ? bounds.y : bounds.x;

  for (const line of lines) {
    const bases = line.children.map((child) => mainSize(child, axis));
    const fixed = bases.reduce((sum, value) => sum + value, 0) + Math.max(0, line.children.length - 1) * gap;
    const flexTotal = line.children.reduce((sum, child) => sum + (child.flex ?? (child.spacer ? 1 : 0)), 0);
    const free = lineLimit - fixed;
    const values = line.children.map((child, index) => {
      const flex = child.flex ?? (child.spacer ? 1 : 0);
      const value = flexTotal > 0 && free > 0 ? bases[index] + (free * flex) / flexTotal : bases[index];
      return Math.max(0, value);
    });
    const used = values.reduce((sum, value) => sum + value, 0) + Math.max(0, values.length - 1) * gap;
    const freeAfterFlex = lineLimit - used;
    const spacing = distributionValues(options.distribution ?? "start", freeAfterFlex, values.length);
    let mainCursor = (axis === "horizontal" ? bounds.x : bounds.y) + spacing.before;

    line.cross = options.wrap ? line.cross : availableCross;
    for (const [index, child] of line.children.entries()) {
      const main = values[index];
      const naturalCross = crossSize(child, axis);
      const cross = options.childSizing === "stretch" || options.align === "stretch"
        ? line.cross
        : naturalCross;
      const crossPosition = crossCursor + alignOffset(line.cross, cross, options.align === "stretch" ? "start" : (options.align as any ?? "start"));
      const size = axis === "horizontal"
        ? constrainedSize(child, main, cross)
        : constrainedSize(child, cross, main);
      setResult(result, child, axis === "horizontal"
        ? { x: mainCursor, y: crossPosition, width: size.width, height: size.height, zIndex: child.zIndex }
        : { x: crossPosition, y: mainCursor, width: size.width, height: size.height, zIndex: child.zIndex });
      mainCursor += main + gap + spacing.extra;
    }
    crossCursor += line.cross + gap;
  }
  return result;
};

export const createLinearDescriptor = (type: string, options: LinearOptions) => (
  createDescriptor(type, (input) => calculateLinear(input, options))
);

