export class Widget {
  #cleanups = [];
  #destroyed = false;

  constructor(element, { type, variant } = {}) {
    if (!element || typeof element.append !== "function") {
      throw new TypeError("A widget must be backed by a DOM element");
    }

    this.element = element;
    if (type) element.dataset.webskinWidget = type;
    if (variant) element.dataset.webskinWidgetVariant = variant;
    Object.defineProperty(element, "destroy", {
      configurable: true,
      value: () => this.destroy(),
    });
  }

  addCleanup(cleanup) {
    if (typeof cleanup !== "function") throw new TypeError("Widget cleanup must be a function");
    if (this.#destroyed) {
      cleanup();
      return cleanup;
    }
    this.#cleanups.push(cleanup);
    return cleanup;
  }

  setState(state, family) {
    this.element.dataset.webskinWidgetState = state;
    if (family) {
      const key = `webskin${String(family).replace(/(^|-)([a-z])/g, (_, __, letter) => letter.toUpperCase())}State`;
      this.element.dataset[key] = state;
    }
    return state;
  }

  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    for (const cleanup of this.#cleanups.splice(0).reverse()) cleanup();
  }
}

