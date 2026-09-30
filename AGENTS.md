# WinDesktop WebSkin agent guide

This file is the repository-level guide for making changes safely. Read it
before changing code that crosses the frontend, backend, theme-runtime, or
Windows-host boundaries.

## Project overview

WinDesktop WebSkin is a Windows desktop-skin application composed of three
cooperating parts:

- `frontend/` is the Astro dashboard. It renders the theme library and uses
  browser-side TypeScript to create, duplicate, rename, delete, and preview
  themes.
- `backend/` is a FastAPI service. It owns theme filesystem access, settings
  persistence, API routes, and static serving for common widgets and installed
  theme packages.
- `wv2wall/` is a separate Git submodule containing the Windows Forms/WebView2
  wallpaper host. It is not part of the pnpm workspace.

The repository also contains authored source projects and browser-ready runtime
content:

```text
common/                     # Vite source project for shared browser modules
themes/                     # Vite source project for built-in themes
localdata/                  # generated runtime assets and persisted data
|-- common/                 # WebSkin-owned browser modules/assets
|   `-- widgets/time/       # plain, digital, and analog time modules
`-- themes/                 # built-in output and user theme packages
```

## Architecture and request flow

In development, run the Astro server on port `4321` and FastAPI on port
`8000`. Astro proxies `/api`, `/common`, and `/themes` to FastAPI, so browser
code can use same-origin URLs such as `/api/themes` and
`/themes/dev/`.

The backend application is assembled in `backend/src/webskin/main.py`:

- `routes.py` defines the settings API, theme-management API, and static asset
  routes.
- `settings.py` is the service layer for settings operations.
- `persistence.py` provides the versioned, atomic JSON storage implementation.
- `themes.py` owns theme package creation, discovery, copying, renaming,
  deletion, and preview persistence.
- `paths.py` is the single source of truth for resolving theme roots and for
  preventing asset paths from escaping their package directories.

The dashboard currently server-renders the bundled `dev` card, then fetches
user-created themes from `GET /api/themes` in the browser. Theme actions call
the corresponding backend endpoints directly. Preview generation loads a
theme in a hidden `1200x800` iframe, captures it with `html2canvas`, and sends
the PNG data URL to `PUT /api/themes/{theme_id}/preview`.

## Theme runtime contract

Themes are browser-ready packages, not Astro, React, Vite, or pnpm projects at
runtime. The backend serves them as ordinary files and never runs a package
manager or build tool while loading a theme.

An installed theme must contain:

- `metadata.json`, with an `id` matching its directory name and a string
  `name`.
- `index.html` as the package entry point.

It may contain CSS, JavaScript, and arbitrary package-local assets. Relative
URLs in `index.html` must work below `/themes/{theme_id}/`. Shared WebSkin
modules are imported from stable URLs, for example:

```js
import { createClock } from "/common/widgets/time/digital-plain.js";
```

Common widgets return normal DOM and expose stable `data-webskin-*` hooks. A
theme decides where to insert and how to style them; there is no widget
registry, DOM scanner, or automatic mounting system.

Theme names become theme IDs and must be valid Windows directory names. Names
are unique case-insensitively. Creation resolves conflicts as `Name`, `Name 2`,
`Name 3`, and so on. Do not introduce a second ID-generation or name-cleaning
implementation in the frontend.

### Theme roots and persistence

`backend/src/webskin/paths.py` resolves a `ThemePaths` object with two roots:

- `THEMES_ROOT/common` serves `/common/...`.
- `THEMES_ROOT/themes` serves `/themes/{theme_id}/...`.

Resolution order:

1. `WEBSKIN_THEMES_ROOT`, when set.
2. Production/frozen mode: `%LOCALAPPDATA%/WinDesktop WebSkin/themes/`.
3. Development mode: the repository's top-level `localdata/` directory,
   populated by the `common` and `themes` Vite builds.

`WEBSKIN_ENV=production`/`prod`/`release` or
`WEBSKIN_PRODUCTION=1|true|yes` selects production mode. Runtime code should
call `get_theme_paths()` rather than caching environment-dependent paths.

Application settings use a separate JSON file at
`%LOCALAPPDATA%/WinDesktopWebskin/settings.json`, unless
`WEBSKIN_SETTINGS_PATH` overrides it. The document is versioned and has the
`app`, `themes`, and `widgets` namespaces. Writes are lock-protected and
atomic.

## API surface

The currently supported endpoints are:

- `GET /api/health` and `GET /api/status` for service checks.
- `/api/settings/...` for app settings and theme/widget-scoped settings.
- `GET /api/themes` to list user themes.
- `POST /api/themes` to create one.
- `POST /api/themes/{id}/duplicate` to copy bundled or user themes.
- `PATCH /api/themes/{id}` to rename one.
- `DELETE /api/themes/{id}` to remove one.
- `PUT`/`GET /api/themes/{id}/preview` for generated PNG previews.
- `GET /common/{path}` and `GET /themes/{id}/{path}` for runtime files.

When adding routes, keep filesystem and business logic in the storage/service
modules and keep route handlers responsible for HTTP validation and error
translation. Preserve the existing stable browser URLs unless a migration is
intentional.

## Development workflow

Requirements currently declared by the repository:

- Node.js `>=22.12.0` for the frontend.
- Python `3.14` and `uv` for the backend.
- Windows/.NET `9` SDK plus the WebView2 runtime for `wv2wall`.

From the repository root:

```bash
pnpm install
pnpm dev                 # frontend and backend in parallel
pnpm dev:frontend        # Astro only
pnpm dev:backend         # FastAPI only
pnpm build               # frontend production build
```

Frontend-only checks:

```bash
pnpm --filter @project/frontend check
pnpm --filter @project/frontend build
```

Backend commands are run through the backend package scripts:

```bash
cd backend
pnpm dev                 # uv run uvicorn ... --reload
pnpm start               # bind on 0.0.0.0:8000
```

The backend exposes interactive API docs at `http://127.0.0.1:8000/docs`.
There is currently no committed automated test suite or root test script, so
changes should at minimum pass the frontend check/build and a local API smoke
check against `/api/health` and the affected endpoint.

## Working on `wv2wall`

`wv2wall` is a Git submodule with its own repository and history. The root
repository tracks only the submodule commit. If changing it:

1. Make and test the change inside `wv2wall/`.
2. Build with `dotnet restore` and `dotnet build -c Release` from
   `wv2wall/wv2wall/`.
3. Commit the change in the submodule repository when appropriate.
4. Update the root repository's submodule pointer only when the root project
   should consume that new commit.

The host uses WinForms/WebView2 to place wallpaper surfaces behind desktop
icons. Its input hooks are system-wide and its behavior depends on Windows
Shell internals (`Progman`/`WorkerW`), so changes there need extra care and
manual testing on Windows.

## Implementation rules and safety boundaries

- Use `apply_patch` for repository edits. Do not overwrite unrelated working
  tree changes.
- Keep frontend API calls aligned with backend response keys. Theme metadata
  intentionally uses keys such as `entry_url`, `preview-after-loadtime`, and
  `allow-new-preview`.
- Use `encodeURIComponent(themeId)` for theme IDs in browser URLs.
- Do not build filesystem paths from unvalidated request strings. Reuse
  `safe_asset_path()` and `UserThemeStorage.content_path()`; both reject
  traversal and escape attempts.
- Preserve atomic file writes for settings, metadata, and previews. Write a
  temporary file in the destination directory and replace the target.
- Treat `metadata.json` and `index.html` as the package boundary. Invalid or
  incomplete packages should not become routable themes.
- Keep generated previews separate from authored package assets. Saving
  `preview.png` makes it authoritative and removes an old `preview.svg`.
- Avoid adding framework/build-time assumptions to the theme runtime. A theme
  must still work when served as static files by FastAPI.
- Do not commit credentials, local settings, package stores, Python caches, or
  .NET build output. Root `.gitignore` already covers these categories.

## Change checklist

Before handing off a change, check the smallest relevant set of items:

- Frontend: `pnpm --filter @project/frontend check` and `build`.
- Backend: start FastAPI and verify `/api/health`; exercise changed routes.
- Theme changes: open `/themes/{id}/` directly, verify relative assets and
  `/common/...` imports, then regenerate a preview if applicable.
- Path/storage changes: test both development paths and an explicit temporary
  `WEBSKIN_THEMES_ROOT`/`WEBSKIN_SETTINGS_PATH`.
- Host changes: build `wv2wall`, and manually check tray behavior, monitor
  modes, mouse forwarding, keyboard focus, and desktop context-menu behavior.
- Review `git status` from both the root and `wv2wall/` before committing so
  submodule changes and generated files are not accidentally included.
