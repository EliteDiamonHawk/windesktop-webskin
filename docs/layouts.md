# Shared layouts

## Static image composition

`/common/compositions/static-image-composition.js` creates one `<img>` from a main
image and ordered overlay images.

```js
import { createStaticImageComposition } from "/common/compositions/static-image-composition.js";

const composition = createStaticImageComposition({
  frame: { width: 500, height: 300 },
  main: { src: "/themes/MyTheme/assets/background.png" },
  images: [
    {
      src: "/themes/MyTheme/assets/decoration.png",
      x: 400,
      y: 200,
      scale: 0.8,
      anchorX: 0.5,
      anchorY: 0.5,
      rotation: 0,
      opacity: 1,
      flipX: false,
      flipY: false,
    },
  ],
});

document.querySelector("#composition").append(composition);
composition.ready.then((succeeded) => {
  if (!succeeded) console.error("Composition failed");
});
```

### Coordinates

`frame.width` and `frame.height` define output logical pixels and final
coordinate space. The canvas uses those exact dimensions. Browser CSS can resize
the returned image without recomposition.

The main image uses centered `cover` fitting:

```text
fitScale = max(frame.width / main.width, frame.height / main.height)
offsetX = (frame.width - main.width * fitScale) / 2
offsetY = (frame.height - main.height * fitScale) / 2
```

Overlay `x` and `y` use main image original pixels. The compositor applies
`offsetX`, `offsetY`, and `fitScale` before drawing each overlay. Overlay
`scale` applies in its own original pixel space. `anchorX` and `anchorY` range
from `0` to `1`; `0.5` centers an image. Rotation uses degrees.

Images draw in array order. Transparent PNG/WebP layers remain transparent in
the PNG output.

### Lifecycle and errors

`update(config)` replaces configuration. Identical composition input skips work;
presentation changes such as `className` and `alt` still apply. The returned
promise and `composition.ready` resolve to `true` on success and `false` on
failure.

`destroy()` revokes the current object URL, clears decoded-image references, and
stops future commits. A failed initial composition leaves the image empty. A
later failed update keeps the last successful result and calls `onError` with
the failed source and optional overlay index.

Image URLs must be same-origin or served with CORS headers that permit canvas
use. Otherwise the browser can load an image but reject canvas export.

The layout keeps no canvas in the document and starts no render loop. It uses a
temporary canvas only during composition, then displays the generated PNG from
one object URL.

## CSS layout wrappers

Layout factories return wrappers. They keep `calculate()` for themes that need
explicit geometry, but ordinary use can rely on browser CSS.

```js
import { createHStack } from "/common/layouts/h-stack.js";

const row = createHStack({ gap: 12, padding: 8 });
row.mount(document.querySelector("#root"));
row.add("clock", document.querySelector("#clock"), { width: 240, height: 80 });
row.add("spacer", document.createElement("span"), { spacer: true });
```

Wrappers expose `element`, `mount`, `add`, `setChildOptions`, `remove`, `get`,
`children`, `apply`, `applyGeometry`, and `dispose`. They mark containers with
`data-webskin-layout` and children with `data-webskin-layout-child`.

Wrappers set layout behavior with CSS properties. Themes can style the wrapper
and its children with normal CSS. `applyGeometry()` remains opt-in:

```js
const geometry = row.calculate({
  width: 800,
  height: 120,
  children: [
    { id: "clock", width: 240, height: 80 },
    { id: "spacer", width: 0, height: 0, spacer: true },
  ],
});
row.applyGeometry(geometry);
```

Responsive wrappers use container queries when their selected layouts expose
CSS state. Call `calculate()` and `applyGeometry()` when a layout needs exact
geometry or a custom descriptor has no CSS state.

## Scene wrappers

`Layer` owns a freeform DOM layer. `Scaler` keeps a design-space content
element and can update it manually or observe its viewport.

```js
import { createLayer, createScaler } from "/common/scene/index.js";

const layer = createLayer({ clip: true });
layer.add("clock", row);

const scaler = createScaler({
  designWidth: 1920,
  designHeight: 1080,
  fit: "contain",
});
scaler.setContent(layer).mount(document.querySelector("#desktop"));
scaler.observe();
```

Call `dispose()` when a theme removes a wrapper. `GeometryRegistry`,
`LayoutManager`, and `applyGeometry()` remain available for animation or other
explicit geometry workflows.
