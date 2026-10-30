import type { Geometry } from "../layouts/types.js";
import type { GeometryEntry } from "./types.js";

const cloneGeometry = (geometry: Geometry | null): Geometry | null => (
  geometry ? { ...geometry } : null
);

const validateGeometry = (geometry: Geometry | null) => {
  if (!geometry) return;
  for (const [name, value] of Object.entries(geometry)) {
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) {
      throw new TypeError(`geometry.${name} must be finite`);
    }
  }
  if (geometry.width < 0 || geometry.height < 0) throw new RangeError("geometry dimensions must be non-negative");
};

const cloneEntry = (entry: GeometryEntry): GeometryEntry => ({
  id: entry.id,
  logical: cloneGeometry(entry.logical),
  desired: cloneGeometry(entry.desired),
  current: cloneGeometry(entry.current),
  metadata: { ...entry.metadata },
});

export class GeometryRegistry {
  #entries = new Map<string, GeometryEntry>();

  register(id: string, geometry: Geometry | null = null, metadata: Record<string, unknown> = {}) {
    if (typeof id !== "string" || id.length === 0) throw new TypeError("geometry id must be a non-empty string");
    if (this.#entries.has(id)) throw new RangeError(`geometry id is already registered: ${id}`);
    validateGeometry(geometry);
    this.#entries.set(id, {
      id,
      logical: cloneGeometry(geometry),
      desired: cloneGeometry(geometry),
      current: cloneGeometry(geometry),
      metadata: { ...metadata },
    });
    return this;
  }

  ensure(id: string, metadata: Record<string, unknown> = {}) {
    if (!this.#entries.has(id)) this.register(id, null, metadata);
    else if (Object.keys(metadata).length > 0) this.updateMetadata(id, metadata);
    return this;
  }

  unregister(id: string) {
    return this.#entries.delete(id);
  }

  has(id: string) {
    return this.#entries.has(id);
  }

  get(id: string): GeometryEntry | undefined {
    const entry = this.#entries.get(id);
    return entry ? cloneEntry(entry) : undefined;
  }

  require(id: string) {
    const entry = this.get(id);
    if (!entry) throw new RangeError(`geometry id is not registered: ${id}`);
    return entry;
  }

  setLogical(id: string, geometry: Geometry | null) {
    validateGeometry(geometry);
    this.requireMutable(id).logical = cloneGeometry(geometry);
    return this;
  }

  setDesired(id: string, geometry: Geometry | null) {
    validateGeometry(geometry);
    this.requireMutable(id).desired = cloneGeometry(geometry);
    return this;
  }

  setCurrent(id: string, geometry: Geometry | null) {
    validateGeometry(geometry);
    this.requireMutable(id).current = cloneGeometry(geometry);
    return this;
  }

  updateMetadata(id: string, metadata: Record<string, unknown>) {
    Object.assign(this.requireMutable(id).metadata, metadata);
    return this;
  }

  entries() {
    return Array.from(this.#entries.values(), cloneEntry);
  }

  snapshot() {
    return Object.fromEntries(this.entries().map((entry) => [entry.id, entry]));
  }

  #requireMutable(id: string) {
    const entry = this.#entries.get(id);
    if (!entry) throw new RangeError(`geometry id is not registered: ${id}`);
    return entry;
  }

  requireMutable(id: string) {
    return this.#requireMutable(id);
  }
}

