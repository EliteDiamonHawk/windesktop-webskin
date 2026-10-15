# Development

Run workspace commands from the repository root.

## Workspace commands

| Command | Result |
| --- | --- |
| `pnpm dev` | Build assets, start Astro and FastAPI, and watch assets |
| `pnpm dev:frontend` | Start Astro |
| `pnpm dev:backend` | Start FastAPI with reload |
| `pnpm dev:common` | Watch the shared asset build |
| `pnpm dev:themes` | Watch the built-in theme build |
| `pnpm build:assets` | Build shared and theme files |
| `pnpm build` | Build assets and the frontend site |

Run the frontend checks with:

```bash
pnpm --filter @project/frontend check
pnpm --filter @project/frontend build
```

## Asset builds

The `common` Vite config copies source files to `localdata/common/` and keeps
their module paths. The `themes` config copies the `dev` package to
`localdata/themes/dev/`. Vite leaves `/common/` imports unresolved.

FastAPI serves the generated files. It does not run Vite or a package manager
when it loads a theme.

## Backend commands

Run these commands from `backend/`:

```bash
pnpm dev
pnpm start
```

The development command runs:

```text
uv run uvicorn webskin.main:app --reload --port 8000 --app-dir src
```

FastAPI publishes its schema at `/docs`.

## Troubleshooting

- A 404 under `/common/` or `/themes/` means the asset build has not run. Run `pnpm build:assets`.
- A dashboard connection error means FastAPI is down or uses another port. Check `/api/health`.
- An unexpected theme root can come from `WEBSKIN_THEMES_ROOT`, `WEBSKIN_ENV`, or `WEBSKIN_PRODUCTION`.
- An unexpected settings file can come from `WEBSKIN_SETTINGS_PATH` or the active environment mode.

