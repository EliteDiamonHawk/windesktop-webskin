# Contributing

## Project boundaries

Keep changes in the project that owns them:

- `dashboard/` contains the Astro dashboard.
- `backend/` contains FastAPI, settings, filesystem, and API code.
- `common/` contains shared browser modules.
- `themes/` contains built-in theme source.
- `wv2wall/` contains the Windows host.

`wv2wall/` has its own Git history and build process. Update the root
submodule pointer only when the root project should consume a new host commit.

Use `apply_patch` for repository edits. Preserve unrelated working-tree changes.
Keep credentials, local settings, package stores, Python caches, and .NET output
out of commits.

## Filesystem rules

- Validate request strings before building filesystem paths.
- Use `safe_asset_path()` and `UserThemeStorage.content_path()` for runtime asset resolution.
- Keep assets inside the theme package.
- Treat `metadata.json` and `index.html` as the package boundary.
- Preserve atomic replacement for settings, metadata, and previews.
- Keep environment path logic in the existing path and storage services.

## Checks

For frontend changes, run:

```bash
pnpm --filter @project/frontend check
pnpm --filter @project/frontend build
```

For backend changes, start FastAPI and call `/api/health` plus each changed
route. For theme changes, open `/themes/{id}/`, check relative assets and
`/common/...` imports, and regenerate a preview when the change affects it.

For path or storage changes, test the development defaults and temporary
`WEBSKIN_THEMES_ROOT` and `WEBSKIN_SETTINGS_PATH` values.

For host changes, run these commands from `wv2wall/wv2wall/`:

```powershell
dotnet restore
dotnet build -c Release
```

Then check tray behavior, monitor modes, mouse forwarding, keyboard focus, and
the desktop context menu.

Review root and submodule status before handoff. Keep generated files and
unrelated submodule changes out of the final change.

