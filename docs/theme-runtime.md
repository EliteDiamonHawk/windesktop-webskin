# Theme runtime

FastAPI serves theme packages as static files. A running theme needs an HTML
entry point, metadata, CSS, JavaScript, and package assets.

## Package files

Every installed theme needs:

- `metadata.json`, with an `id` that matches the directory name and a string
  `name`.
- `index.html`, the package entry point.

The package can contain CSS, JavaScript, and asset directories. Relative URLs
in `index.html` resolve below `/themes/{theme_id}/`.

```text
Theme Name/
├── metadata.json
├── index.html
├── theme.css
└── assets/
```

Import shared modules from `/common/`:

```js
import { createClock } from "/common/widgets/time/clock-digital-plain.js";

document.querySelector("#clock").append(createClock());
```

## Runtime roots

`backend/src/webskin/paths.py` selects the runtime root in this order:

1. `WEBSKIN_THEMES_ROOT`, when set.
2. `%LOCALAPPDATA%/WinDesktop WebSkin/themes/` in production, release, or
   frozen mode.
3. The repository's `localdata/` directory in development.

The selected root contains `common/` and `themes/`. Call `get_theme_paths()`
when code needs these paths. Do not cache a value that depends on environment
variables.

## IDs and names

The backend uses the theme name as the directory name and ID. Windows path
rules apply. Names must be unique without regard to case. A conflict produces
`Name`, `Name 2`, `Name 3`, and later names in that sequence.

The backend cleans names and creates IDs. Keep that logic in the backend.

The backend routes a package only when `metadata.json` and `index.html` pass
validation. Asset resolution rejects traversal and paths outside the package.
