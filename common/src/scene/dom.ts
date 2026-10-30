import type { Geometry } from "../layouts/types.js";

const lastApplied = new WeakMap<object, Geometry>();

const sameGeometry = (left: Geometry | undefined, right: Geometry) => (
  left?.x === right.x
  && left?.y === right.y
  && left?.width === right.width
  && left?.height === right.height
  && left?.zIndex === right.zIndex
);

const validateGeometry = (geometry: Geometry) => {
  for (const [name, value] of Object.entries(geometry)) {
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) {
      throw new TypeError(`geometry.${name} must be finite`);
    }
  }
  if (geometry.width < 0 || geometry.height < 0) throw new RangeError("geometry dimensions must be non-negative");
};

export function applyGeometry(element: HTMLElement, geometry: Geometry): boolean {
  if (!element || !element.style) throw new TypeError("geometry target must be an element");
  validateGeometry(geometry);
  if (sameGeometry(lastApplied.get(element), geometry)) return false;
  element.style.position = "absolute";
  element.style.width = `${geometry.width}px`;
  element.style.height = `${geometry.height}px`;
  element.style.transform = `translate3d(${geometry.x}px, ${geometry.y}px, 0)`;
  if (geometry.zIndex === undefined) element.style.removeProperty("z-index");
  else element.style.zIndex = String(geometry.zIndex);
  lastApplied.set(element, { ...geometry });
  return true;
}

export function clearAppliedGeometry(element: HTMLElement) {
  lastApplied.delete(element);
}

