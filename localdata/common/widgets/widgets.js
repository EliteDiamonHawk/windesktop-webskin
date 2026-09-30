/**
 * Shared contract for WebSkin widgets.
 *
 * Widgets own a DOM element and may register cleanup callbacks. Consumers can
 * always call `element.destroy?.()` when removing a widget from the page.
 */
export class Widget {
  #cleanups = [];
  #destroyed = false;

  constructor(element, { type } = {}) {
    if (!element || typeof element.append !== "function") {
      throw new TypeError("A widget must be backed by a DOM element");
    }

    this.element = element;
    if (type) element.dataset.webskinWidget = type;
    Object.defineProperty(element, "destroy", {
      configurable: true,
      value: () => this.destroy(),
    });
  }

  /** Register work that must be undone when the widget is destroyed. */
  addCleanup(cleanup) {
    if (typeof cleanup !== "function") throw new TypeError("Widget cleanup must be a function");
    if (this.#destroyed) {
      cleanup();
      return cleanup;
    }
    this.#cleanups.push(cleanup);
    return cleanup;
  }

  /** Stop timers, listeners, and other resources owned by this widget. */
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    for (const cleanup of this.#cleanups.splice(0).reverse()) cleanup();
  }
}

