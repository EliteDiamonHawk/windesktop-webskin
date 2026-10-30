import type { Geometry } from "../layouts/types.js";
import { applyGeometry } from "./dom.js";
import type { LayerOptions, SceneRenderable } from "./types.js";

const elementOf = (value: SceneRenderable) => (
  typeof value === "object" && value !== null && "element" in value
    ? value.element
    : value
);

export class Layer {
  readonly element: HTMLDivElement;
  #children = new Map<string, HTMLElement>();

  constructor(options: LayerOptions = {}) {
    if (typeof document === "undefined" && !options.element) throw new Error("Layers require a document");
    this.element = options.element ?? document.createElement("div");
    this.element.dataset.webskinScene = "layer";
    if (options.className !== undefined) this.element.className = options.className;
    this.element.style.position = "relative";
    this.element.style.overflow = options.clip ? "hidden" : "visible";
    if (options.zIndex !== undefined) this.element.style.zIndex = String(options.zIndex);
  }

  add(id: string, child: SceneRenderable) {
    if (typeof id !== "string" || id.length === 0) throw new TypeError("layer child id must be a non-empty string");
    if (this.#children.has(id)) throw new RangeError(`layer child id is already used: ${id}`);
    const element = elementOf(child);
    this.#children.set(id, element);
    this.element.append(element);
    return element;
  }

  remove(id: string) {
    const element = this.#children.get(id);
    if (!element) return false;
    element.remove();
    this.#children.delete(id);
    return true;
  }

  get(id: string) {
    return this.#children.get(id);
  }

  children() {
    return new Map(this.#children);
  }

  setGeometry(geometry: Geometry) {
    applyGeometry(this.element, geometry);
    return this;
  }

  setVisible(visible: boolean) {
    this.element.hidden = !visible;
    this.element.style.visibility = visible ? "visible" : "hidden";
    return this;
  }

  setClip(clip: boolean) {
    this.element.style.overflow = clip ? "hidden" : "visible";
    return this;
  }

  setZIndex(zIndex: number | undefined) {
    if (zIndex === undefined) this.element.style.removeProperty("z-index");
    else this.element.style.zIndex = String(zIndex);
    return this;
  }
}

export const createLayer = (options: LayerOptions = {}) => new Layer(options);

