# Development

## Workspace commands

Run these commands from the repository root:

| Command | Use |
| --- | --- |
| `pnpm dev` | Build assets and start all webskin services |
| `pnpm dev:frontend` | Start Astro |
| `pnpm dev:backend` | Start FastAPI with reload |
| `pnpm dev:common` | Watch the common asset build |
| `pnpm dev:themes` | Watch the built-in theme build |
| `pnpm build:assets` | Build common and theme files |
| `pnpm build` | Build assets and the frontend site |

Run the frontend checks with:

```bash
pnpm --filter @project/frontend check
pnpm --filter @project/frontend build
```

## Asset builds

The `common` Vite config preserves module paths and copies source files to
`localdata/common/`. The `themes` config copies the `dev` package to
`localdata/themes/dev/` and leaves `/common/` imports external.

FastAPI serves those files. The backend does not run Vite or a package manager
when it loads a theme.

## Backend commands

Run from `backend/`:

```bash
pnpm dev
pnpm start
```

The reload command runs `uv run uvicorn webskin.main:app --reload --port 8000
--app-dir src`. Open `/docs` for the FastAPI schema.

## Troubleshooting

- A 404 under `/common/` or `/themes/` usually means the asset build has not
  run. Run `pnpm build:assets`.
- A dashboard connection error means FastAPI is down or listens on another
  port. Check `/api/health`.
- A wrong runtime root points to `WEBSKIN_THEMES_ROOT`, `WEBSKIN_ENV`, or
  `WEBSKIN_PRODUCTION`.
- A wrong settings file points to `WEBSKIN_SETTINGS_PATH` or the active
  environment mode.
