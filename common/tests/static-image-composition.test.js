import assert from "node:assert/strict";
import test from "node:test";

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.dataset = {};
    this.attributes = {};
    this.className = "";
    this.width = 0;
    this.height = 0;
    this.alt = "";
    this.src = "";
  }

  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; if (name === "src") this.src = ""; }
}

const drawCalls = [];
const canvasState = { canvases: [], blobs: 0, disableToBlob: false };

class FakeContext {
  constructor() {
    this.imageSmoothingEnabled = false;
    this.imageSmoothingQuality = "low";
    this.globalAlpha = 1;
  }

  save() { drawCalls.push({ type: "save" }); }
  restore() { drawCalls.push({ type: "restore" }); }
  translate(x, y) { drawCalls.push({ type: "translate", x, y }); }
  rotate(angle) { drawCalls.push({ type: "rotate", angle }); }
  scale(x, y) { drawCalls.push({ type: "scale", x, y }); }
  drawImage(...args) { drawCalls.push({ type: "drawImage", args, alpha: this.globalAlpha }); }
}

class FakeCanvas extends FakeElement {
  constructor() {
    super("canvas");
    this.context = new FakeContext();
    canvasState.canvases.push(this);
    if (canvasState.disableToBlob) this.toBlob = undefined;
  }

  getContext(type) { return type === "2d" ? this.context : null; }

  toBlob(callback, type) {
    canvasState.blobs += 1;
    callback({ type, canvas: this });
  }
}

class FakeImage {
  static dimensions = new Map();
  static instances = [];

  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.onload = null;
    this.onerror = null;
    FakeImage.instances.push(this);
  }

  set src(value) {
    this._src = value;
    const dimensions = FakeImage.dimensions.get(value);
    if (!dimensions) {
      queueMicrotask(() => this.onerror?.(new Error("missing image")));
      return;
    }
    this.naturalWidth = dimensions[0];
    this.naturalHeight = dimensions[1];
    this.complete = true;
    queueMicrotask(() => this.onload?.());
  }

  get src() { return this._src; }

  decode() { return Promise.resolve(); }
}

const objectUrls = [];
const revokedUrls = [];
let moduleValue;

const installDom = async () => {
  globalThis.Image = FakeImage;
  globalThis.URL = {
    createObjectURL: (blob) => {
      const url = `blob:test-${objectUrls.length + 1}`;
      objectUrls.push({ url, blob });
      return url;
    },
    revokeObjectURL: (url) => revokedUrls.push(url),
  };
  globalThis.document = {
    createElement: (tagName) => tagName === "canvas" ? new FakeCanvas() : new FakeElement(tagName),
  };
  moduleValue = await import("../src/layouts/static-image-composition.js?static-image-test");
};

const reset = () => {
  drawCalls.splice(0);
  canvasState.canvases.splice(0);
  canvasState.blobs = 0;
  canvasState.disableToBlob = false;
  objectUrls.splice(0);
  revokedUrls.splice(0);
  FakeImage.instances.splice(0);
  FakeImage.dimensions = new Map([
    ["main", [1000, 600]],
    ["wide-main", [1000, 500]],
    ["overlay", [100, 50]],
    ["overlay-two", [20, 20]],
  ]);
};

test.before(installDom);
test.beforeEach(reset);

test("creates one logical-size image and maps overlays through main cover scale", async () => {
  const element = moduleValue.createStaticImageComposition({
    frame: { width: 500, height: 300 },
    main: { src: "main" },
    images: [{
      src: "overlay",
      x: 400,
      y: 200,
      scale: 0.8,
      anchorX: 0.5,
      anchorY: 0.5,
      rotation: 90,
      opacity: 0.5,
      flipX: true,
      flipY: false,
    }],
  });

  assert.equal(element.tagName, "img");
  assert.equal(element.dataset.webskinLayout, "static-image-composition");
  assert.equal(element.width, 500);
  assert.equal(element.height, 300);
  assert.equal(await element.ready, true);
  assert.equal(canvasState.canvases.length, 1);
  assert.equal(canvasState.canvases[0].width, 0);
  assert.equal(canvasState.canvases[0].height, 0);
  assert.deepEqual(canvasState.canvases[0].context.imageSmoothingQuality, "high");
  assert.deepEqual(drawCalls[0], {
    type: "drawImage",
    args: [FakeImage.instances[0], 0, 0, 500, 300],
    alpha: 1,
  });
  assert.deepEqual(drawCalls.filter((call) => call.type === "translate")[0], {
    type: "translate",
    x: 200,
    y: 100,
  });
  assert.deepEqual(drawCalls.filter((call) => call.type === "scale")[0], {
    type: "scale",
    x: -0.4,
    y: 0.4,
  });
  assert.equal(drawCalls.filter((call) => call.type === "rotate")[0].angle, Math.PI / 2);
  assert.equal(drawCalls.at(-2).type, "drawImage");
  assert.equal(drawCalls.at(-2).alpha, 0.5);
});

test("accounts for center crop and preserves overlay ordering", async () => {
  const element = moduleValue.createStaticImageComposition({
    frame: { width: 500, height: 500 },
    main: { src: "wide-main" },
    images: [
      { src: "overlay", x: 400, y: 200, anchorX: 0, anchorY: 0 },
      { src: "overlay-two", x: 100, y: 100, anchorX: 0, anchorY: 0 },
    ],
  });

  assert.equal(await element.ready, true);
  const translates = drawCalls.filter((call) => call.type === "translate");
  assert.deepEqual(translates, [
    { type: "translate", x: 150, y: 200 },
    { type: "translate", x: -150, y: 100 },
  ]);
  assert.equal(drawCalls.filter((call) => call.type === "drawImage").length, 3);
});

test("skips unchanged composition and replaces then revokes old object URL", async () => {
  const onError = () => {};
  const element = moduleValue.createStaticImageComposition({
    frame: { width: 100, height: 100 },
    main: { src: "main" },
    onError,
  });
  assert.equal(await element.ready, true);
  assert.equal(canvasState.blobs, 1);
  const imageCount = FakeImage.instances.length;
  const firstUrl = element.src;

  await element.update({ frame: { width: 100, height: 100 }, main: { src: "main" }, onError });
  assert.equal(canvasState.blobs, 1);
  assert.equal(FakeImage.instances.length, imageCount);

  await element.update({ frame: { width: 120, height: 100 }, main: { src: "main" }, onError });
  assert.equal(canvasState.blobs, 2);
  assert.equal(revokedUrls.includes(firstUrl), true);
  element.destroy();
  assert.equal(revokedUrls.includes(element.src), false);
  assert.equal(revokedUrls.length, 2);
});

test("reports failures and preserves last successful output", async () => {
  const errors = [];
  const element = moduleValue.createStaticImageComposition({
    frame: { width: 100, height: 100 },
    main: { src: "main" },
    onError: (error, details) => errors.push({ error, details }),
  });
  assert.equal(await element.ready, true);
  const previousUrl = element.src;
  const result = await element.update({
    frame: { width: 100, height: 100 },
    main: { src: "main" },
    images: [{ src: "missing", x: 0, y: 0 }],
    onError: (error, details) => errors.push({ error, details }),
  });

  assert.equal(result, false);
  assert.equal(element.src, previousUrl);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].details.source, "missing");
  assert.equal(errors[0].details.layerIndex, 0);
});

test("reports unsupported canvas export", async () => {
  canvasState.disableToBlob = true;
  const errors = [];
  const element = moduleValue.createStaticImageComposition({
    frame: { width: 100, height: 100 },
    main: { src: "main" },
    onError: (error) => errors.push(error),
  });

  assert.equal(await element.ready, false);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /Canvas export is not supported/);
});

test("validates frame and overlay values", () => {
  assert.throws(
    () => moduleValue.createStaticImageComposition({ frame: { width: 0, height: 1 }, main: { src: "main" } }),
    /frame.width must be a positive integer/,
  );
  assert.throws(
    () => moduleValue.createStaticImageComposition({
      frame: { width: 1, height: 1 },
      main: { src: "main" },
      images: [{ src: "overlay", x: 0, y: 0, opacity: 2 }],
    }),
    /opacity must be between 0 and 1/,
  );
});
