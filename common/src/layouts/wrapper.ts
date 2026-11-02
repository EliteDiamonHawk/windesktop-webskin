import { applyGeometry as applyElementGeometry } from "../scene/dom.js";
import type {
  LayoutChildOptions,
  LayoutDescriptor,
  LayoutDomOptions,
  LayoutRenderable,
  LayoutResult,
  LayoutStyleMap,
  LayoutStyleProvider,
  LayoutWrapper,
} from "./types.js";

type StyleCallback<T> = (options: T) => LayoutStyleMap;
type ChildStyleCallback<T> = (options: T, index: number, id: string) => LayoutStyleMap;

export type LayoutWrapperConfig<T extends LayoutDomOptions> = {
  container?: StyleCallback<T>;
  outer?: StyleCallback<T>;
  child?: ChildStyleCallback<LayoutChildOptions>;
  onApply?: (element: HTMLDivElement, wrapper: LayoutWrapper) => void;
  onDispose?: () => void;
  content?: boolean;
};

const elementOf = (value: LayoutRenderable) => {
  const element = typeof value === "object" && value !== null && "element" in value
    ? value.element
    : value;
  if (!element || typeof element !== "object" || !element.style) throw new TypeError("layout child must be an element");
  return element;
};

const writeStyles = (element: HTMLElement, styles: LayoutStyleMap, previous: Set<string>) => {
  const cssName = (property: string) => property.startsWith("--")
    ? property
    : property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  const jsName = (property: string) => property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
  const write = (property: string, value: string | undefined) => {
    const name = cssName(property);
    const javascriptName = jsName(property);
    if (value === undefined) {
      element.style.removeProperty(name);
      if (!property.startsWith("--")) (element.style as unknown as Record<string, string>)[javascriptName] = "";
      return;
    }
    if (!property.startsWith("--")) {
      (element.style as unknown as Record<string, string>)[javascriptName] = value;
    }
    element.style.setProperty(name, value);
  };
  const next = new Set<string>();
  for (const [property, value] of Object.entries(styles)) {
    next.add(property);
    write(property, value === undefined || value === null ? undefined : String(value));
  }
  for (const property of previous) if (!next.has(property)) write(property, undefined);
  previous.clear();
  for (const property of next) previous.add(property);
};

class LayoutWrapperImpl<T extends LayoutDomOptions> implements LayoutWrapper {
  readonly type: string;
  readonly calculate: LayoutDescriptor["calculate"];
  readonly #options: T;
  readonly #containerStyles: StyleCallback<T>;
  readonly #outerStyles: StyleCallback<T>;
  readonly #childStyles: ChildStyleCallback<LayoutChildOptions>;
  readonly #onApply?: (element: HTMLDivElement, wrapper: LayoutWrapper) => void;
  readonly #onDispose?: () => void;
  readonly #hasContent: boolean;
  #element?: HTMLDivElement;
  #contentElement?: HTMLDivElement;
  #children = new Map<string, HTMLElement>();
  #childOptions = new Map<string, LayoutChildOptions>();
  #containerProperties = new Set<string>();
  #contentProperties = new Set<string>();
  #childProperties = new Map<string, Set<string>>();
  #disposed = false;

  constructor(
    type: string,
    options: T,
    calculate: LayoutDescriptor["calculate"],
    config: LayoutWrapperConfig<T> = {},
  ) {
    this.type = type;
    this.#options = options;
    this.calculate = calculate;
    this.#containerStyles = config.container ?? (() => ({}));
    this.#outerStyles = config.outer ?? (() => ({}));
    this.#childStyles = config.child ?? (() => ({}));
    this.#onApply = config.onApply;
    this.#onDispose = config.onDispose;
    this.#hasContent = config.content ?? false;
  }

  get element() {
    this.#requireActive();
    if (!this.#element) {
      if (typeof document === "undefined") throw new Error("Layout wrappers require a document");
      this.#element = this.#options.element ?? document.createElement("div");
      this.#element.dataset.webskinLayout = this.type;
      if (this.#options.className !== undefined) this.#element.className = this.#options.className;
      if (this.#hasContent) {
        this.#contentElement = document.createElement("div");
        this.#contentElement.dataset.webskinLayoutContent = this.type;
        this.#element.append(this.#contentElement);
      }
      this.apply();
    }
    return this.#element;
  }

  mount(parent: Node) {
    this.#requireActive();
    if (!parent || typeof (parent as Node & { append?: unknown }).append !== "function") {
      throw new TypeError("layout parent must support append");
    }
    parent.append(this.element);
    return this;
  }

  add(id: string, child: LayoutRenderable, options: LayoutChildOptions = {}) {
    this.#requireActive();
    if (typeof id !== "string" || id.length === 0) throw new TypeError("layout child id must be a non-empty string");
    if (this.#children.has(id)) throw new RangeError(`layout child id is already used: ${id}`);
    const element = elementOf(child);
    this.#children.set(id, element);
    this.#childOptions.set(id, { ...options });
    this.#childProperties.set(id, new Set());
    (this.#contentElement ?? this.element).append(element);
    this.apply();
    return element;
  }

  setChildOptions(id: string, options: LayoutChildOptions) {
    this.#requireActive();
    if (!this.#children.has(id)) throw new RangeError(`layout child id is not registered: ${id}`);
    this.#childOptions.set(id, { ...options });
    this.apply();
    return this;
  }

  remove(id: string) {
    this.#requireActive();
    const element = this.#children.get(id);
    if (!element) return false;
    element.remove();
    this.#children.delete(id);
    this.#childOptions.delete(id);
    this.#childProperties.delete(id);
    this.apply();
    return true;
  }

  get(id: string) {
    return this.#children.get(id);
  }

  getChildOptions(id: string) {
    const options = this.#childOptions.get(id);
    return options ? { ...options } : undefined;
  }

  children() {
    return new Map(this.#children);
  }

  getContainerStyles() {
    return { ...this.#containerStyles(this.#options) };
  }

  getChildStyles(options: LayoutChildOptions, index: number, id: string) {
    return { ...this.#childStyles(options, index, id) };
  }

  apply() {
    this.#requireActive();
    if (!this.#element) return this;
    this.#element.dataset.webskinLayout = this.type;
    writeStyles(this.#element, this.#outerStyles(this.#options), this.#containerProperties);
    writeStyles(this.#contentElement ?? this.#element, this.getContainerStyles(), this.#contentProperties);
    Array.from(this.#children.entries()).forEach(([id, element], index) => {
      element.dataset.webskinLayoutChild = id;
      writeStyles(element, this.getChildStyles(this.#childOptions.get(id) ?? {}, index, id), this.#childProperties.get(id)!);
    });
    this.#onApply?.(this.#element, this);
    return this;
  }

  applyGeometry(result: LayoutResult) {
    this.#requireActive();
    for (const [id, geometry] of Object.entries(result)) {
      const element = this.#children.get(id);
      if (element) applyElementGeometry(element, geometry);
    }
    return this;
  }

  dispose() {
    if (this.#disposed) return;
    this.#onDispose?.();
    this.#children.clear();
    this.#childOptions.clear();
    this.#childProperties.clear();
    this.#containerProperties.clear();
    this.#contentProperties.clear();
    this.#disposed = true;
  }

  #requireActive() {
    if (this.#disposed) throw new Error("layout wrapper is disposed");
  }
}

export const createLayoutWrapper = <T extends LayoutDomOptions>(
  type: string,
  options: T,
  calculate: LayoutDescriptor["calculate"],
  config: LayoutWrapperConfig<T> = {},
): LayoutWrapper => new LayoutWrapperImpl(type, options, calculate, config);

export const isLayoutWrapper = (value: LayoutDescriptor): value is LayoutWrapper => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LayoutWrapper>;
  return typeof candidate.getContainerStyles === "function"
    && typeof candidate.getChildStyles === "function"
    && typeof candidate.apply === "function";
};

export const layoutStyleProvider = (value: LayoutDescriptor): LayoutStyleProvider | undefined => (
  isLayoutWrapper(value) ? value : undefined
);
