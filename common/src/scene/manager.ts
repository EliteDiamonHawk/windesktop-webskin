import { finite, nonNegative } from "../layouts/internal/geometry.js";
import type { Geometry, LayoutChild, LayoutDescriptor, LayoutInput, LayoutResult, Size } from "../layouts/types.js";
import { applyGeometry } from "./dom.js";
import { GeometryRegistry } from "./registry.js";

const addGeometry = (child: Geometry, parent: Geometry | null): Geometry => ({
  x: child.x + (parent?.x ?? 0),
  y: child.y + (parent?.y ?? 0),
  width: child.width,
  height: child.height,
  ...(child.zIndex === undefined ? {} : { zIndex: child.zIndex }),
});

export class LayoutManager {
  readonly registry: GeometryRegistry;
  #elements = new Map<string, HTMLElement>();

  constructor(registry = new GeometryRegistry()) {
    this.registry = registry;
  }

  bind(id: string, element: HTMLElement) {
    if (!element) throw new TypeError("layout element is required");
    this.registry.ensure(id);
    this.#elements.set(id, element);
    return this;
  }

  unbind(id: string) {
    return this.#elements.delete(id);
  }

  place(id: string, geometry: Geometry, metadata: Record<string, unknown> = {}) {
    this.registry.ensure(id, metadata);
    this.registry.setLogical(id, geometry).setDesired(id, geometry);
    return this.registry.get(id);
  }

  move(id: string, x: number, y: number) {
    finite(x, "x");
    finite(y, "y");
    const entry = this.registry.require(id);
    const base = entry.desired ?? entry.logical ?? entry.current;
    if (!base) throw new RangeError(`geometry id has no geometry: ${id}`);
    return this.registry.setDesired(id, { ...base, x, y }).get(id);
  }

  resize(id: string, width: number, height: number) {
    nonNegative(width, "width");
    nonNegative(height, "height");
    const entry = this.registry.require(id);
    const base = entry.desired ?? entry.logical ?? entry.current;
    if (!base) throw new RangeError(`geometry id has no geometry: ${id}`);
    return this.registry.setDesired(id, { ...base, width, height }).get(id);
  }

  setCurrent(id: string, geometry: Geometry | null) {
    this.registry.setCurrent(id, geometry);
    return this.registry.get(id);
  }

  applyCurrent(id: string) {
    const element = this.#elements.get(id);
    if (!element) throw new RangeError(`layout element is not bound: ${id}`);
    const geometry = this.registry.require(id).current ?? this.registry.require(id).desired;
    if (!geometry) return false;
    return applyGeometry(element, geometry);
  }

  applyLayout(layout: LayoutDescriptor, bounds: Size, children: readonly LayoutChild[], parentId?: string): LayoutResult {
    const input: LayoutInput = { width: bounds.width, height: bounds.height, children };
    const result = layout.calculate(input);
    for (const child of children) {
      const geometry = result[child.id];
      if (!geometry) continue;
      this.registry.ensure(child.id, parentId === undefined ? {} : { parentId });
      this.registry.setLogical(child.id, geometry).setDesired(child.id, geometry);
      if (child.layout && child.children) this.applyLayout(child.layout, geometry, child.children, child.id);
    }
    return result;
  }

  changeLayout(layout: LayoutDescriptor, bounds: Size, children: readonly LayoutChild[], parentId?: string) {
    return this.applyLayout(layout, bounds, children, parentId);
  }

  getGlobalGeometry(id: string, state: "logical" | "desired" | "current" = "desired") {
    let entry = this.registry.require(id);
    let geometry = entry[state];
    if (!geometry) return null;
    const visited = new Set<string>([id]);
    let parentId = entry.metadata.parentId;
    while (typeof parentId === "string") {
      if (visited.has(parentId)) throw new RangeError("geometry parent cycle detected");
      visited.add(parentId);
      const parent = this.registry.require(parentId);
      const parentGeometry = parent[state];
      if (!parentGeometry) break;
      geometry = addGeometry(geometry, parentGeometry);
      parentId = parent.metadata.parentId;
    }
    return geometry;
  }
}

export const createLayoutManager = (registry?: GeometryRegistry) => new LayoutManager(registry);

