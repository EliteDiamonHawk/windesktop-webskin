import assert from "node:assert/strict";
import test from "node:test";

const { appendCompiledFiles, compileDeclarativeTheme } = await import("./compiler/declarative.js");

const theme = {
  schemaVersion: 1,
  id: "demo",
  name: "Demo",
  files: {
    scene: "./scene.json",
    styles: ["./styles/theme.css"],
  },
  viewport: {
    designSize: { width: 1920, height: 1080 },
    fit: "responsive",
    overflow: "hidden",
  },
  screenSupport: {
    profiles: [{ id: "generic", match: { any: true } }],
    fallbackProfile: "generic",
  },
  customization: {
    settingsNamespace: "themes",
    invalidValuePolicy: "use-default",
  },
};

const scene = {
  schemaVersion: 1,
  root: {
    kind: "stack",
    id: "root",
    background: {
      kind: "background",
      id: "background",
      composition: {
        mode: "runtime",
        main: { src: "./assets/background.png" },
        anchor: { source: "center", viewport: "center" },
        overlays: [],
      },
    },
    layers: [
      {
        kind: "layer",
        id: "widgets",
        zIndex: 10,
        content: {
          kind: "layout",
          id: "content",
          layout: { type: "center" },
          children: [
            {
              kind: "widget",
              id: "clock",
              module: {
                path: "widgets/time/clock/digital-plain.js",
                export: "createClock",
              },
              props: { format: "24h", seconds: false },
            },
          ],
        },
      },
    ],
  },
};

const sourceFiles = {
  "theme.json": JSON.stringify(theme),
  "scene.json": JSON.stringify(scene),
  "styles/theme.css": ".demo { color: white; }",
  "assets/background.png": new Blob(["not-an-image"], { type: "image/png" }),
};

test("compiles declarative source into a theme package", async () => {
  const result = await compileDeclarativeTheme({ files: sourceFiles });

  assert.equal(result.ok, true);
  assert.equal(result.themeId, "demo");
  assert.deepEqual(result.diagnostics, []);

  const paths = result.files.map(({ path }) => path).sort();
  assert.deepEqual(paths, [
    "assets/background.png",
    "generated/runtime.js",
    "generated/theme.css",
    "index.html",
    "metadata.json",
    "styles/theme.css",
  ]);

  const index = await result.files.find(({ path }) => path === "index.html").blob.text();
  const runtime = await result.files.find(({ path }) => path === "generated/runtime.js").blob.text();
  assert.match(index, /data-ws-scene="root"/);
  assert.match(index, /generated\/runtime\.js/);
  assert.match(runtime, /digital-plain\.js/);
});

test("returns diagnostics and no package for invalid source", async () => {
  const result = await compileDeclarativeTheme({
    files: {
      "theme.json": JSON.stringify({ ...theme, id: "bad id" }),
      "scene.json": JSON.stringify({ ...scene, root: { ...scene.root, background: undefined } }),
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.files.length, 0);
  assert.ok(result.diagnostics.some(({ code }) => code === "WS-INVALID-ID"));
  assert.ok(result.diagnostics.some(({ code }) => code === "WS-MISSING-BACKGROUND"));
});

test("appends compiled files without sending them", async () => {
  const result = await compileDeclarativeTheme({ files: sourceFiles });
  const formData = appendCompiledFiles(new FormData(), result);
  const uploadedNames = formData.getAll("files").map((file) => file.name).sort();

  assert.deepEqual(uploadedNames, [
    "assets/background.png",
    "generated/runtime.js",
    "generated/theme.css",
    "index.html",
    "metadata.json",
    "styles/theme.css",
  ]);
});
