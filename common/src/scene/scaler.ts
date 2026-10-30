import { nonNegative, positive } from "../layouts/internal/geometry.js";
import type { ScalerFit, ScalerOptions, ScaleResult, SceneRenderable } from "./types.js";

const elementOf = (value: SceneRenderable) => (
  typeof value === "object" && value !== null && "element" in value
    ? value.element
    : value
);

export class Scaler {
  readonly element: HTMLDivElement;
  readonly contentElement: HTMLDivElement;
  readonly designWidth: number;
  readonly designHeight: number;
  readonly fit: ScalerFit;
  readonly manualScale: number;

  constructor(options: ScalerOptions) {
    positive(options.designWidth, "designWidth");
    positive(options.designHeight, "designHeight");
    if (typeof document === "undefined" && !options.element) throw new Error("Scalers require a document");
    this.element = options.element ?? document.createElement("div");
    this.contentElement = options.contentElement ?? document.createElement("div");
    this.designWidth = options.designWidth;
    this.designHeight = options.designHeight;
    this.fit = options.fit ?? "manual";
    this.manualScale = options.scale ?? 1;
    positive(this.manualScale, "scale");
    const originX = options.transformOrigin?.x ?? 0;
    const originY = options.transformOrigin?.y ?? 0;
    nonNegative(originX, "transformOrigin.x");
    nonNegative(originY, "transformOrigin.y");
    this.element.dataset.webskinScene = "scaler";
    this.contentElement.dataset.webskinScene = "scaler-content";
    this.element.style.position = "relative";
    this.element.style.overflow = "hidden";
    this.contentElement.style.position = "absolute";
    this.contentElement.style.width = `${this.designWidth}px`;
    this.contentElement.style.height = `${this.designHeight}px`;
    this.contentElement.style.transformOrigin = `${originX * 100}% ${originY * 100}%`;
    if (!this.contentElement.parentNode) this.element.append(this.contentElement);
  }

  setContent(content: SceneRenderable) {
    this.contentElement.append(elementOf(content));
    return this;
  }

  update(width: number, height: number): ScaleResult {
    nonNegative(width, "viewport.width");
    nonNegative(height, "viewport.height");
    let scale = this.manualScale;
    if (this.fit === "contain") scale = Math.min(width / this.designWidth, height / this.designHeight);
    else if (this.fit === "cover") scale = Math.max(width / this.designWidth, height / this.designHeight);
    else if (this.fit === "width") scale = width / this.designWidth;
    else if (this.fit === "height") scale = height / this.designHeight;
    const scaledWidth = this.designWidth * scale;
    const scaledHeight = this.designHeight * scale;
    const centered = this.fit === "contain" || this.fit === "cover";
    const x = centered ? (width - scaledWidth) / 2 : 0;
    const y = centered ? (height - scaledHeight) / 2 : 0;
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
    this.contentElement.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    return { scale, x, y, width: scaledWidth, height: scaledHeight };
  }
}

export const createScaler = (options: ScalerOptions) => new Scaler(options);

