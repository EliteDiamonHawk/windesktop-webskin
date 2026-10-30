import type { SpacerSpec } from "./types.js";
import { nonNegative } from "./internal/geometry.js";

export type SpacerOptions = {
  flex?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
};

export function createSpacer(options: SpacerOptions = {}): SpacerSpec {
  const result: SpacerSpec = {
    spacer: true,
    flex: options.flex ?? 1,
  };
  if (options.flex !== undefined) nonNegative(options.flex, "flex");
  for (const [key, value] of Object.entries(options)) {
    if (key !== "flex" && value !== undefined) {
      nonNegative(value, key);
      (result as any)[key] = value;
    }
  }
  return Object.freeze(result);
}

