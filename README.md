# WinDesktop WebSkin

## Development

Install the frontend dependencies and start both services from the root:

```bash
pnpm install
pnpm dev
```

The frontend runs at `http://localhost:4321` and proxies `/api`, `/common`,
and `/themes` to the backend at `http://127.0.0.1:8000`.

## Theme runtime

Themes are browser-ready runtime packages, not framework-specific source
projects. The repository keeps them in one top-level root:

```text
localdata/
├── common/                 # WebSkin-owned browser modules and shared assets
│   └── widgets/clock/
│       ├── plain.js
│       ├── digital.js
│       └── analog.js
└── themes/                 # installed theme packages
    └── dev/
        ├── metadata.json
        ├── index.html
        ├── style.css
        └── script.js
```

An installed theme must provide `metadata.json` and `index.html`; it may also
include CSS, JavaScript, and assets. Framework-based themes should be built
before installation. WebSkin never runs npm, pnpm, yarn, Vite, or Astro while
loading a theme.

The backend serves common files at `/common/...` and theme files at
`/themes/<theme-id>/...`. A theme can consume a shared widget directly:

```js
import { createClock } from "/common/widgets/clock/plain.js";

document.querySelector("#clock").append(createClock());
```

The plain clock returns normal DOM with stable `data-webskin-clock-part`
attributes. The digital and analog variants add WebSkin styling; the theme
still decides where to insert either returned element. There is no widget
registry, DOM scanner, or automatic mounting system.

## Theme roots

`backend/src/webskin/paths.py` is the single source of truth for locations.
Development resolves `THEMES_ROOT` to the repository's top-level `localdata/`.
Production resolves it to `%LOCALAPPDATA%/WinDesktop WebSkin/themes/` using the
Windows `LOCALAPPDATA` value. `WEBSKIN_THEMES_ROOT` is available as an explicit
host override. `THEMES_ROOT/common` and `THEMES_ROOT/themes` are served
independently.

User theme content is served from `/themes/{theme_id}/`, so relative asset URLs
in `index.html` work without any React, Astro, Tailwind, or pnpm requirement.
Theme IDs are the final theme names. Names are unique case-insensitively; when
needed, creation automatically chooses names such as `Theme`, `Theme 2`, and
`Theme 3`.

Downloaded themes will eventually use the same runtime path: extracting a
package into `THEMES_ROOT/themes/<theme-id>/` is sufficient. They do not need a
frontend rebuild or registration code. The `common/` directory is WebSkin-owned
and may be updated with the application; theme packages remain independent.

Preview capture produces `preview.png` through the backend preview API. Once a
generated preview is saved, the backend removes the package's old `preview.svg`
so the generated PNG becomes authoritative.
