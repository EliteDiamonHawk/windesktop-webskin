# WinDesktop WebSkin

## Development

Install the workspace dependencies and start the application from the root:

```bash
pnpm install
pnpm dev
```

The command first builds the browser assets, then watches `common/` and
`themes/` while running the frontend and backend. The frontend runs at
`http://localhost:4321` and proxies `/api`, `/common`, and `/themes` to the
backend at `http://127.0.0.1:8000`.

`pnpm build:assets` performs a one-time Vite build. `pnpm dev:common` and
`pnpm dev:themes` run the individual asset watchers.

## Theme runtime

Themes are browser-ready runtime packages, not framework-specific projects at
runtime. Authored source and generated runtime files are separate:

```text
common/                      # Vite source for shared browser modules
`-- src/widgets/time/
themes/                      # Vite source for built-in themes
`-- dev/
localdata/                   # generated/runtime output
|-- common/                  # generated from common/
`-- themes/                  # built-in output and user runtime themes
    `-- dev/
```

An installed theme must provide `metadata.json` and `index.html`; it may also
include CSS, JavaScript, and assets. Framework-based themes should be built
before installation. WebSkin never runs npm, pnpm, yarn, Vite, or Astro while
loading a theme.

The backend serves common files at `/common/...` and theme files at
`/themes/<theme-id>/...`. A theme can consume a shared widget directly:

```js
import { createClock } from "/common/widgets/time/digital-plain.js";

document.querySelector("#clock").append(createClock());
```

Shared widgets follow the contract in `/common/widgets/widgets.js`: each
widget returns its root DOM element and exposes an optional `destroy()` method
for cleanup. The plain clock implementations extend the shared `Widget`
base, and styled clock variants build on those plain implementations.

The plain clock returns normal DOM with stable `data-webskin-clock-part`
attributes. The digital and analog variants add WebSkin styling; the theme
still decides where to insert either returned element. There is no widget
registry, DOM scanner, or automatic mounting system.

Plain calendar widgets are available from `/common/widgets/time/`:

```js
import { createDate } from "/common/widgets/time/formatted-date-plain.js";
import { createDay } from "/common/widgets/time/single-day-plain.js";
import { createWeek } from "/common/widgets/time/week-plain.js";
import { createMonth } from "/common/widgets/time/month-plain.js";

document.querySelector("#calendar").append(createMonth());

// Keep today's date in a stable position while the seven-day window rolls.
document.querySelector("#week").append(createWeek({ daysBefore: 1, daysAfter: 5 }));
// Lock the anchor date to an exact month-grid column and row, or just a row.
document.querySelector("#month").append(createMonth({ lockDay: { x: 3, y: 2 } }));
document.querySelector("#month-row").append(createMonth({ lockDay: { y: 2 } }));
document.querySelector("#month-five-weeks").append(createMonth({ maxWeeks: 5 }));
```

Calendar widgets use local browser dates and locale formatting. They expose
`data-webskin-calendar-part` hooks and represented-date state attributes for
theme-owned styling, and accept an explicit `Date` or local `YYYY-MM-DD`
string when a fixed date is needed. `maxWeeks: 5` limits a month to five
visible weeks; for an unlocked six-week month, the visible window shifts to
the final five weeks when the anchor date reaches week five or six.

Pre-styled calendar variants wrap the same plain widgets and add a prepared
surface treatment:

```js
import { createMonth } from "/common/widgets/time/month-prestyled.js";

document.querySelector("#calendar").append(createMonth({
  color: "#cfb5ab",
  backgroundColor: "#5b4841",
}));
```

Pre-styled widgets expose `--webskin-calendar-color`,
`--webskin-calendar-background`, `--webskin-calendar-border`,
`--webskin-calendar-today-background`, `--webskin-calendar-today-color`, and
`--webskin-calendar-adjacent-opacity` for theme-owned overrides.

## Theme roots

`backend/src/webskin/paths.py` is the single source of truth for locations.
Development resolves `THEMES_ROOT` to the repository's top-level `localdata/`,
which is populated from the root `common/` and `themes/` source projects.
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
frontend rebuild or registration code. The generated `localdata/common/`
directory is WebSkin-owned and may be updated with the application; source
themes remain independent.

Preview capture produces `preview.png` through the backend preview API. Once a
generated preview is saved, the backend removes the package's old `preview.svg`
so the generated PNG becomes authoritative.
