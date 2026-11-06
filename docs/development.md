# Development

Run workspace commands from the repository root.

## Workspace commands

| Command | Result |
| --- | --- |
| `pnpm dev` | Build assets, start Vite and ASP.NET Core, and watch assets |
| `pnpm dev:frontend` | Start Vite |
| `pnpm dev:backend` | Start ASP.NET Core with watch |
| `pnpm dev:common` | Watch the shared asset build |
| `pnpm dev:themes` | Watch the built-in theme build |
| `pnpm build:assets` | Build shared and theme files |
| `pnpm build` | Build assets and the frontend site |

Run frontend checks with:

```bash
pnpm --filter @project/frontend check
pnpm --filter @project/frontend build
```

## Asset builds

The `common` Vite config copies source files and `public/` assets to
`localdata/common/` and keeps their module paths. The `themes` config copies the `dev` package to
`localdata/themes/dev/`. Vite leaves `/common/` imports unresolved.

ASP.NET Core serves generated files. It does not run Vite or a package manager
when it loads a theme.

## Backend commands

Run these commands from `backend/`:

```bash
pnpm dev
pnpm start
```

The development command runs:

```text
dotnet watch --project src/WebSkin.Backend/WebSkin.Backend.csproj run -- --urls http://127.0.0.1:8000
```

ASP.NET Core publishes its schema at `/docs`.

## Troubleshooting

- A 404 under `/common/` or `/themes/` means the asset build has not run. Run `pnpm build:assets`.
- A dashboard connection error means ASP.NET Core is down or uses another port. Check `/api/health`.
- An unexpected theme root can come from `WEBSKIN_THEMES_ROOT`, `WEBSKIN_ENV`, or `WEBSKIN_PRODUCTION`.
- `pnpm dev:backend` sets `WEBSKIN_DEV=true`; system controls execute by default in other runs.
- An unexpected settings directory can come from `WEBSKIN_SETTINGS_PATH` or the active environment mode.

