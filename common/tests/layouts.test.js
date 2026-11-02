import assert from "node:assert/strict";
import test from "node:test";

import { createAspectRatio } from "../src/layouts/aspect-ratio.js";
import { createCanvas } from "../src/layouts/canvas.js";
import { createCenter } from "../src/layouts/center.js";
import { createDock } from "../src/layouts/dock.js";
import { createFlow } from "../src/layouts/flow.js";
import { createGrid } from "../src/layouts/grid.js";
import { createHStack } from "../src/layouts/h-stack.js";
import { createOverlay } from "../src/layouts/overlay.js";
import { createResponsive } from "../src/layouts/responsive.js";
import { createScroll } from "../src/layouts/scroll.js";
import { createSplit } from "../src/layouts/split.js";
import { createVStack } from "../src/layouts/v-stack.js";
import { createZStack } from "../src/layouts/z-stack.js";

const child = (id, width, height, extra = {}) => ({ id, width, height, ...extra });

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
    this.textContent = "";
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

globalThis.document = {
  head: new FakeElement("head"),
  documentElement: new FakeElement("html"),
  createElement: (tagName) => new FakeElement(tagName),
};

test("stacks distribute spacer space and honor padding", () => {
  const result = createHStack({ gap: 5, padding: 2 }).calculate({
    width: 100,
    height: 20,
    children: [
      child("a", 10, 5),
      child("space", 0, 5, { spacer: true }),
      child("b", 10, 5),
    ],
  });

  assert.deepEqual(result.a, { x: 2, y: 2, width: 10, height: 5 });
  assert.equal(result.space.x, 17);
  assert.equal(result.space.width, 66);
  assert.deepEqual(result.b, { x: 88, y: 2, width: 10, height: 5 });
});

test("vertical stack supports center alignment and distribution", () => {
  const result = createVStack({ distribution: "space-between", align: "center" }).calculate({
    width: 100,
    height: 100,
    children: [child("a", 20, 10), child("b", 40, 20)],
  });

  assert.deepEqual(result.a, { x: 40, y: 0, width: 20, height: 10 });
  assert.deepEqual(result.b, { x: 30, y: 80, width: 40, height: 20 });
});

test("flow wraps variable-size children", () => {
  const result = createFlow({ gap: 5 }).calculate({
    width: 100,
    height: 100,
    children: [child("a", 40, 10), child("b", 40, 20), child("c", 40, 15)],
  });

  assert.equal(result.a.x, 0);
  assert.equal(result.b.x, 45);
  assert.equal(result.c.x, 0);
  assert.equal(result.c.y, 25);
});

test("grid supports explicit placement and spans", () => {
  const result = createGrid({ columns: 2, gap: 10 }).calculate({
    width: 100,
    height: 100,
    children: [
      child("wide", 20, 20, { gridColumn: 1, columnSpan: 2 }),
      child("next", 20, 20),
    ],
  });

  assert.deepEqual(result.wide, { x: 0, y: 0, width: 100, height: 45 });
  assert.equal(result.next.x, 0);
  assert.equal(result.next.y, 55);
});

test("split allocates fixed and ratio regions", () => {
  const result = createSplit({
    regions: [{ size: 30 }, { ratio: 7 }],
    gap: 10,
  }).calculate({
    width: 100,
    height: 50,
    children: [child("left", 1, 1), child("right", 1, 1)],
  });

  assert.deepEqual(result.left, { x: 0, y: 0, width: 30, height: 50 });
  assert.deepEqual(result.right, { x: 40, y: 0, width: 60, height: 50 });
});

test("overlay, aspect ratio, dock, and canvas preserve local geometry", () => {
  const overlay = createOverlay({ position: "bottom-right" }).calculate({
    width: 100,
    height: 100,
    children: [child("content", 80, 80), child("badge", 10, 10)],
  });
  assert.deepEqual(overlay.badge, { x: 70, y: 70, width: 10, height: 10 });

  const aspect = createAspectRatio({ ratio: 16 / 9 }).calculate({
    width: 160,
    height: 160,
    children: [child("video", 1, 1)],
  });
  assert.deepEqual(aspect.video, { x: 0, y: 35, width: 160, height: 90 });

  const dock = createDock().calculate({
    width: 100,
    height: 100,
    children: [child("top", 1, 10, { dock: "top" }), child("body", 1, 1, { dock: "fill" })],
  });
  assert.deepEqual(dock.top, { x: 0, y: 0, width: 100, height: 10 });
  assert.deepEqual(dock.body, { x: 0, y: 10, width: 100, height: 90 });

  const canvas = createCanvas().calculate({
    width: 100,
    height: 100,
    children: [child("item", 20, 10, { position: { right: 5, bottom: 7 } })],
  });
  assert.deepEqual(canvas.item, { x: 75, y: 83, width: 20, height: 10 });
});

test("responsive selects first matching rule and falls back", () => {
  const wide = createHStack();
  const narrow = createVStack();
  const responsive = createResponsive({
    rules: [{ when: { minWidth: 800 }, layout: wide }],
    fallback: narrow,
  });
  const children = [child("a", 10, 10), child("b", 10, 10)];

  assert.equal(responsive.calculate({ width: 1000, height: 100, children }).b.x, 10);
  assert.equal(responsive.calculate({ width: 100, height: 100, children }).b.y, 10);
});

test("layout input rejects duplicate ids and invalid geometry", () => {
  assert.throws(
    () => createHStack().calculate({ width: 10, height: 10, children: [child("a", 1, 1), child("a", 1, 1)] }),
    /duplicate id/,
  );
  assert.throws(
    () => createCanvas().calculate({ width: 10, height: 10, children: [child("a", 1, 1, { position: { x: 1, right: 1 } })] }),
    /conflicting horizontal anchors/,
  );
});

test("layout wrappers apply CSS, manage children, and support explicit geometry", () => {
  const wrapper = createHStack({ gap: 4, padding: 2, className: "theme-row" });
  const parent = new FakeElement("main");
  const first = new FakeElement("div");
  const second = new FakeElement("div");

  wrapper.mount(parent).add("first", first, { width: 20, height: 10 });
  wrapper.add("second", second, { spacer: true });

  assert.equal(wrapper.element.dataset.webskinLayout, "h-stack");
  assert.equal(wrapper.element.className, "theme-row");
  assert.equal(wrapper.element.style.display, "flex");
  assert.equal(wrapper.element.style.flexDirection, "row");
  assert.equal(wrapper.element.style.gap, "4px");
  assert.equal(first.dataset.webskinLayoutChild, "first");
  assert.equal(first.style.width, "20px");
  assert.equal(second.style.flex, "1 1 auto");
  assert.equal(wrapper.get("first"), first);
  assert.equal(wrapper.children().size, 2);

  wrapper.applyGeometry({ first: { x: 3, y: 4, width: 20, height: 10 } });
  assert.equal(first.style.transform, "translate3d(3px, 4px, 0)");
  wrapper.setChildOptions("first", { width: 30, height: 10 });
  assert.equal(first.style.width, "30px");
  assert.equal(wrapper.remove("second"), true);
  wrapper.dispose();
  assert.equal(wrapper.children().size, 0);
  assert.throws(() => wrapper.apply(), /disposed/);
});

test("responsive wrappers emit scoped container rules", () => {
  const responsive = createResponsive({
    rules: [{ when: { minWidth: 800 }, layout: createVStack() }],
    fallback: createHStack(),
  });
  responsive.add("item", new FakeElement("div"));

  const style = [
    ...(globalThis.document.head?.children ?? []),
    ...responsive.element.children,
  ].find((element) => element.tagName === "style");
  assert.ok(style);
  assert.match(style.textContent, /@container \(min-width: 800px\)/);
  assert.match(style.textContent, /flex-direction: column/);
  const container = responsive.element;
  responsive.dispose();
  assert.equal(globalThis.document.head?.children.includes(style) ?? container.children.includes(style), false);
});

test("every layout factory can attach a DOM child", () => {
  const wrappers = [
    createAspectRatio({ ratio: 1 }),
    createCanvas(),
    createCenter(),
    createDock(),
    createFlow(),
    createGrid(),
    createHStack(),
    createOverlay(),
    createResponsive({ rules: [], fallback: createHStack() }),
    createScroll(),
    createSplit(),
    createVStack(),
    createZStack(),
  ];

  for (const wrapper of wrappers) {
    wrapper.add("child", new FakeElement("div"), { width: 10, height: 10 });
    assert.equal(wrapper.element.dataset.webskinLayout.length > 0, true);
    wrapper.dispose();
  }
});

