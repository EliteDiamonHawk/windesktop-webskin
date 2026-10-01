# Getting started

## Requirements

- Node.js `>=22.12.0`
- Python `3.14`
- `pnpm`
- `uv`

The Windows host uses .NET and WebView2. Read its
[`README.md`](../wv2wall/README.md) for those requirements.

## Install and run

Run these commands from the repository root:

```bash
pnpm install
pnpm dev
```

The root command builds common and built-in theme assets, then starts the
frontend, backend, and asset watchers.

Open these URLs:

- Dashboard: `http://localhost:4321`
- API: `http://127.0.0.1:8000`
- API docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/api/health`

Astro proxies `/api`, `/common`, and `/themes` to FastAPI. Browser code can
use those paths without a second origin.

## Run one service

```bash
pnpm dev:frontend
pnpm dev:backend
pnpm dev:common
pnpm dev:themes
```

From `backend/`, use:

```bash
pnpm dev
pnpm start
```
