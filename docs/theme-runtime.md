# Theme runtime

FastAPI serves each theme as a static package. The package needs an HTML entry
point and metadata. It can include CSS, JavaScript, and other assets.

## Package files

Every routable theme needs:

- `metadata.json`, with an `id` that matches the directory name and a string `name`.
- `index.html`, the package entry point.

Relative URLs in `index.html` resolve below `/themes/{theme_id}/`.

```text
Theme Name/
|-- metadata.json
|-- index.html
|-- theme.css
`-- assets/
```

Import shared modules from `/common/`:

```js
import { createClock } from "/common/widgets/time/clock-digital-plain.js";

document.querySelector("#clock").append(createClock());
```

`metadata.json` and `index.html` form the package boundary. A package without
either file stays off the theme list and returns 404 from asset routes.

## Runtime roots

`backend/src/webskin/paths.py` selects the root in this order:

1. `WEBSKIN_THEMES_ROOT`, when set.
2. `%LOCALAPPDATA%/WinDesktop WebSkin/themes/` in production, release, or frozen mode.
3. The repository `localdata/` directory in development.

The selected root contains `common/` and `themes/`. Call `get_theme_paths()`
when code needs these directories. The function reads the environment for each
request, so tests and embedded hosts can change the root before handling one.

## IDs and names

The backend uses a theme name as its directory name and ID. Windows path rules
apply. Names must be unique without regard to case. A duplicate name receives
the next available suffix: `Name`, `Name 2`, `Name 3`.

The backend cleans names and creates IDs. Keep that logic in the backend.
Asset resolution rejects traversal and paths outside the package.

