import type { Geometry } from "../layouts/types.js";

export type GeometryEntry = {
  id: string;
  logical: Geometry | null;
  desired: Geometry | null;
  current: Geometry | null;
  metadata: Record<string, unknown>;
};

export type SceneRenderable = HTMLElement | { element: HTMLElement };

export type LayerOptions = {
  element?: HTMLDivElement;
  className?: string;
  clip?: boolean;
  zIndex?: number;
};

export type ScalerFit = "contain" | "cover" | "width" | "height" | "manual";

export type ScalerOptions = {
  designWidth: number;
  designHeight: number;
  fit?: ScalerFit;
  scale?: number;
  transformOrigin?: { x?: number; y?: number };
  element?: HTMLDivElement;
  contentElement?: HTMLDivElement;
};

export type ScaleResult = {
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

