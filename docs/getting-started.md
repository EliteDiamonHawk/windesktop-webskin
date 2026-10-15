# Getting started

## Requirements

- Node.js `>=22.12.0`
- Python `3.14`
- `pnpm`
- `uv`

The Windows host also needs .NET and WebView2. Read
[`wv2wall/README.md`](../wv2wall/README.md) for its requirements.

## Install and start

Run these commands from the repository root:

```bash
pnpm install
pnpm dev
```

`pnpm dev` builds the shared assets and the built-in theme, then starts Astro,
FastAPI, and the asset watchers.

Open these URLs:

| Service | URL |
| --- | --- |
| Dashboard | `http://localhost:4321` |
| API | `http://127.0.0.1:8000` |
| API schema | `http://127.0.0.1:8000/docs` |
| Health check | `http://127.0.0.1:8000/api/health` |

Astro proxies `/api`, `/common`, and `/themes` to FastAPI. Browser code can
use those paths from the dashboard origin.

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

