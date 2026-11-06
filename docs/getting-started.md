# Getting started

## Requirements

- Node.js `>=22.12.0`
- .NET SDK `10.0` or newer
- `pnpm`

## Install and start

Run these commands from the repository root:

```bash
pnpm install
pnpm dev
```

`pnpm dev` builds shared assets and built-in theme, then starts Vite, ASP.NET
Core, and asset watchers.

Open these URLs:

| Service | URL |
| --- | --- |
| Dashboard | `http://localhost:4321` |
| API | `http://127.0.0.1:8000` |
| API schema | `http://127.0.0.1:8000/docs` |
| Health check | `http://127.0.0.1:8000/api/health` |

Vite proxies `/api`, `/common`, and `/themes` to ASP.NET Core. Browser code can
use those paths from dashboard origin.

## Run the production-shaped build

Build the dashboard and shared assets, then start ASP.NET Core:

```bash
pnpm build
pnpm --dir backend start
```

Open `http://127.0.0.1:8000/`. ASP.NET Core serves the dashboard from the
selected runtime root's `dashboard/` directory and serves theme packages
through its existing `/themes/` routes.

The build does not include themes. Add theme packages to the directory selected
by `WEBSKIN_THEMES_ROOT`. In development, the default is the repository's
`localdata/` directory. In production, the default is
`%LOCALAPPDATA%/WebSkin/themes/`.

Use the same `WEBSKIN_THEMES_ROOT` and production environment variables while
building and starting the backend. This keeps dashboard, common, and theme
files under one runtime root when those assets are built for that environment.

## Start one service

From the repository root:

```bash
pnpm dev:frontend
pnpm dev:backend
pnpm dev:common
pnpm dev:themes
```

From `backend/`:

```bash
pnpm dev
pnpm start
```

