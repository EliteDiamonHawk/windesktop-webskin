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

