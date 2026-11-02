import assert from "node:assert/strict";
import test from "node:test";

class FakeStyle {
  #values = new Map();

  setProperty(name, value) { this.#values.set(name, String(value)); }
  getPropertyValue(name) { return this.#values.get(name) ?? ""; }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.style = new FakeStyle();
    this.className = "";
    this.id = "";
    this.textContent = "";
    this.type = "";
    this.listeners = new Map();
  }

  append(...children) {
    children.forEach((child) => {
      if (child && typeof child === "object") child.parentNode = this;
      this.children.push(child);
    });
  }
  replaceChildren(...children) {
    this.children.forEach((child) => {
      if (child?.parentNode === this) child.parentNode = null;
    });
    this.children = [];
    this.append(...children);
  }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  removeEventListener(name, listener) {
    if (this.listeners.get(name) === listener) this.listeners.delete(name);
  }
  click() { return this.listeners.get("click")?.({ type: "click", target: this }); }
}

const installDom = () => {
  const head = new FakeElement("head");
  globalThis.document = {
    head,
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: (id) => head.children.find((child) => child.id === id) ?? null,
  };
};

let smallWidgetFrame;
test.before(async () => {
  installDom();
  ({ smallWidgetFrame } = await import("../src/frames/small-widget-frame.js?frame-test"));
});

test("creates 11:10 frame with optional parts and current greyscale defaults", () => {
  const frame = smallWidgetFrame();

  assert.equal(frame.tagName, "section");
  assert.equal(frame.dataset.webskinFrame, "small-widget-frame");
  assert.match(frame.className, /webskin-frame--small-widget/);
  assert.equal(frame.parts.value.textContent, "");
  assert.equal(frame.parts.subtext.textContent, "");
  assert.equal(frame.parts.value.dataset.webskinFramePart, "value");
  assert.equal(frame.parts.subtext.dataset.webskinFramePart, "subtext");
  assert.equal(frame.parts.icon.dataset.webskinFramePart, "icon");
  assert.equal(frame.parts.iconFrame.dataset.webskinFramePart, "icon-frame");
  assert.equal(frame.parts.actions.dataset.webskinFramePart, "actions");
  assert.equal(frame.parts.icon.children.length, 0);
  assert.equal(frame.parts.iconFrame.children.length, 0);
  assert.equal(frame.parts.actions.children.length, 0);
  assert.match(document.head.children[0].textContent, /aspect-ratio: 11 \/ 10/);
  assert.match(document.head.children[0].textContent, /--webskin-small-widget-content-left: 10\.6534cqw/);
  assert.match(document.head.children[0].textContent, /--webskin-small-widget-icon-right: 10\.6534cqw/);
  assert.match(document.head.children[0].textContent, /--webskin-small-widget-icon-top: 10\.9375%/);
  assert.match(document.head.children[0].textContent, /width: 27%/);
  assert.match(document.head.children[0].textContent, /--webskin-small-widget-content-top: 55\.46875%/);
  assert.match(document.head.children[0].textContent, /--webskin-small-widget-content-bottom: 14\.84375%/);
  assert.match(document.head.children[0].textContent, /--webskin-small-widget-content-gap: 0cqw/);
  assert.match(document.head.children[0].textContent, /font-size: 20cqw/);
  assert.match(document.head.children[0].textContent, /font-size: 12cqw/);
  assert.match(document.head.children[0].textContent, /grid-template-columns: repeat\(auto-fit, minmax\(0, 1fr\)\)/);
  assert.match(document.head.children[0].textContent, /gap: 7\.10227cqw/);
  assert.match(document.head.children[0].textContent, /border-radius: 999px/);
  assert.match(document.head.children[0].textContent, /color-mix\(in srgb/);
  assert.match(document.head.children[0].textContent, /#2e2e2e/);
  assert.match(document.head.children[0].textContent, /#d6d6d6/);
});

test("initializes text, preserves direct widget updates, and accepts custom class", () => {
  const frame = smallWidgetFrame({ value: "40%", subtext: "RAM", className: "custom-frame" });

  assert.equal(frame.parts.value.textContent, "40%");
  assert.equal(frame.parts.subtext.textContent, "RAM");
  assert.match(frame.className, /custom-frame/);

  frame.parts.value.textContent = "41%";
  frame.parts.subtext.textContent = "Memory";
  assert.equal(frame.parts.value.textContent, "41%");
  assert.equal(frame.parts.subtext.textContent, "Memory");
  assert.equal("setValue" in frame, false);
  assert.equal("setSubtext" in frame, false);
});

test("inserts widget-owned icon nodes and leaves actions for widget controls", () => {
  const icon = new FakeElement("img");
  const iconFrame = new FakeElement("svg");
  const buttonOne = new FakeElement("button");
  const buttonTwo = new FakeElement("button");
  const frame = smallWidgetFrame({ icon, iconFrame });

  assert.deepEqual(frame.parts.icon.children, [icon]);
  assert.deepEqual(frame.parts.iconFrame.children, [iconFrame]);
  assert.equal(frame.parts.actions.children.length, 0);

  frame.parts.actions.append(buttonOne, buttonTwo);
  assert.deepEqual(frame.parts.actions.children, [buttonOne, buttonTwo]);
  assert.equal(frame.querySelector, undefined);
});

test("manages up to two buttons and updates button state in place", () => {
  const calls = [];
  const frame = smallWidgetFrame({
    buttons: [
      { text: "One", onClick: (event, owner) => calls.push([event.type, owner]) },
      { text: "Two", onClick: () => calls.push(["two"]) },
    ],
  });
  const first = frame.parts.actions.children[0];

  assert.equal(frame.parts.actions.children.length, 2);
  assert.equal(first.type, "button");
  assert.equal(first.textContent, "One");
  first.click();
  assert.deepEqual(calls[0], ["click", frame]);

  frame.updateButton(0, {
    text: "Updated",
    onClick: () => calls.push(["updated"]),
  });
  assert.equal(frame.parts.actions.children[0], first);
  assert.equal(first.textContent, "Updated");
  first.click();
  assert.deepEqual(calls[1], ["updated"]);

  frame.setButtons([{ text: "Only", onClick: () => {} }]);
  assert.equal(frame.parts.actions.children.length, 1);
  assert.equal(frame.parts.actions.children[0], first);
  frame.setButtons([]);
  assert.equal(frame.parts.actions.children.length, 0);
  assert.throws(
    () => frame.setButtons([
      { text: "One", onClick: () => {} },
      { text: "Two", onClick: () => {} },
      { text: "Three", onClick: () => {} },
    ]),
    RangeError,
  );
});

test("maps color options to public CSS custom properties", () => {
  const frame = smallWidgetFrame({
    color: "#fff",
    backgroundColor: "#111",
    borderColor: "#222",
    subtextColor: "#aaa",
    iconFrameColor: "#bbb",
    iconColor: "#000",
  });

  assert.equal(frame.style.getPropertyValue("--webskin-small-widget-color"), "#fff");
  assert.equal(frame.style.getPropertyValue("--webskin-small-widget-background"), "#111");
  assert.equal(frame.style.getPropertyValue("--webskin-small-widget-border"), "#222");
  assert.equal(frame.style.getPropertyValue("--webskin-small-widget-subtext-color"), "#aaa");
  assert.equal(frame.style.getPropertyValue("--webskin-small-widget-icon-frame-color"), "#bbb");
  assert.equal(frame.style.getPropertyValue("--webskin-small-widget-icon-color"), "#000");
});
