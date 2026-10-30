# Shared layouts

## Static image composition

`/common/layouts/static-image-composition.js` creates one `<img>` from a main
image and ordered overlay images.

```js
import { createStaticImageComposition } from "/common/layouts/static-image-composition.js";

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
