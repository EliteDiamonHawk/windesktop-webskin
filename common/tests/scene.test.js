import assert from "node:assert/strict";
import test from "node:test";

class FakeStyle {
  constructor() { this.values = {}; }
  setProperty(name, value) { this.values[name] = String(value); this[name] = String(value); }
  removeProperty(name) { delete this.values[name]; delete this[name]; }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.dataset = {};
    this.style = new FakeStyle();
    this.children = [];
    this.parentNode = null;
    this.hidden = false;
    this.scrollLeft = 0;
    this.scrollTop = 0;
  }

  append(...children) {
    for (const child of children) {
      child.parentNode = this;
      this.children.push(child);
    }
  }

  remove() {
    this.parentNode?.children.splice(this.parentNode.children.indexOf(this), 1);
    this.parentNode = null;
  }
}

globalThis.document = { createElement: (tagName) => new FakeElement(tagName) };

const { applyGeometry } = await import("../src/scene/dom.js");
const { Layer } = await import("../src/scene/layer.js");
const { LayoutManager } = await import("../src/scene/manager.js");
const { GeometryRegistry } = await import("../src/scene/registry.js");
const { Scaler } = await import("../src/scene/scaler.js");
const { createScroll } = await import("../src/layouts/scroll.js");
const { createHStack } = await import("../src/layouts/h-stack.js");
const { createVStack } = await import("../src/layouts/v-stack.js");

test("registry separates desired and current geometry", () => {
  const registry = new GeometryRegistry();
  const manager = new LayoutManager(registry);
  manager.place("clock", { x: 100, y: 50, width: 40, height: 20 });
  assert.deepEqual(registry.require("clock").current, null);
  assert.deepEqual(registry.require("clock").desired, { x: 100, y: 50, width: 40, height: 20 });
  manager.setCurrent("clock", { x: 0, y: 50, width: 40, height: 20 });
  assert.equal(registry.require("clock").current.x, 0);
  assert.equal(registry.require("clock").desired.x, 100);
});

test("manager applies nested layouts in local coordinate spaces", () => {
  const manager = new LayoutManager();
  const result = manager.applyLayout(
    createHStack({ gap: 10 }),
    { width: 100, height: 50 },
    [
      { id: "group", width: 40, height: 20, layout: createVStack({ gap: 5 }), children: [
        { id: "one", width: 10, height: 5 },
        { id: "two", width: 10, height: 5 },
      ] },
      { id: "other", width: 20, height: 20 },
    ],
  );

  assert.equal(result.group.x, 0);
  assert.equal(manager.registry.require("two").desired.y, 10);
  assert.equal(manager.getGlobalGeometry("two").x, 0);
  assert.equal(manager.getGlobalGeometry("two").y, 10);
});

test("DOM applier skips unchanged geometry", () => {
  const element = new FakeElement("div");
  const geometry = { x: 4, y: 5, width: 20, height: 10, zIndex: 3 };
  assert.equal(applyGeometry(element, geometry), true);
  assert.equal(element.style.transform, "translate3d(4px, 5px, 0)");
  assert.equal(applyGeometry(element, geometry), false);
  assert.equal(element.style.width, "20px");
});

test("Layer owns freeform children and Scaler preserves design dimensions", () => {
  const layer = new Layer({ clip: true });
  const child = new FakeElement("div");
  layer.add("child", child);
  assert.equal(layer.get("child"), child);
  assert.equal(layer.element.style.overflow, "hidden");
  layer.setVisible(false);
  assert.equal(layer.element.hidden, true);

  const scaler = new Scaler({ designWidth: 800, designHeight: 600, fit: "contain" });
  const result = scaler.update(400, 400);
  assert.deepEqual(result, { scale: 0.5, x: 0, y: 50, width: 400, height: 300 });
  assert.equal(scaler.contentElement.style.width, "800px");
  assert.match(scaler.contentElement.style.transform, /scale\(0\.5\)/);
});

test("Scroll keeps child geometry and configures overflow", () => {
  const scroll = createScroll({ direction: "both", initialScrollLeft: 4, initialScrollTop: 8 });
  const element = scroll.createElement();
  assert.equal(element.style.overflowX, "auto");
  assert.equal(element.style.overflowY, "auto");
  assert.equal(element.scrollLeft, 4);
  assert.equal(element.scrollTop, 8);
  assert.deepEqual(scroll.calculate({
    width: 100,
    height: 100,
    children: [{ id: "item", x: 12, y: 14, width: 30, height: 40 }],
  }).item, { x: 12, y: 14, width: 30, height: 40 });
});

