import { normalizePadding } from "./geometry.js";
import type { Alignment, LayoutChildOptions, LayoutStyleMap, Padding } from "../types.js";

export const px = (value: number | undefined) => value === undefined ? undefined : `${value}px`;

export const paddingStyles = (padding: Padding | undefined): LayoutStyleMap => {
  const values = normalizePadding(padding);
  return {
    paddingTop: px(values.top),
    paddingRight: px(values.right),
    paddingBottom: px(values.bottom),
    paddingLeft: px(values.left),
  };
};

export const flexAlignment = (alignment: Alignment | undefined) => {
  if (alignment === "center") return "center";
  if (alignment === "end") return "flex-end";
  if (alignment === "stretch") return "stretch";
  return "flex-start";
};

export const justifyContent = (distribution: string | undefined) => {
  if (distribution === "center") return "center";
  if (distribution === "end") return "flex-end";
  if (distribution === "space-between") return "space-between";
  if (distribution === "space-around") return "space-around";
  if (distribution === "space-evenly") return "space-evenly";
  return "flex-start";
};

export const childSizeStyles = (options: LayoutChildOptions): LayoutStyleMap => ({
  width: px(options.width),
  height: px(options.height),
  minWidth: px(options.minWidth),
  maxWidth: px(options.maxWidth),
  minHeight: px(options.minHeight),
  maxHeight: px(options.maxHeight),
  zIndex: options.zIndex,
});

export const flexChildStyles = (options: LayoutChildOptions): LayoutStyleMap => ({
  ...childSizeStyles(options),
  flex: options.flex !== undefined ? `${options.flex} 1 auto` : (options.spacer ? "1 1 auto" : undefined),
});

export const absoluteBaseStyles = (options: LayoutChildOptions): LayoutStyleMap => ({
  ...childSizeStyles(options),
  position: "absolute",
});
