# Contributing

## Project boundaries

Keep changes in the project that owns them:

- `dashboard/` contains the Vite dashboard.
- `backend/` contains ASP.NET Core, settings, filesystem, and API code.
- `common/` contains shared browser modules.
- `dev/themes/` contains built-in theme source.
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

For backend changes, start ASP.NET Core and call `/api/health` plus each changed
route. For theme changes, open `/themes/{id}/`, check relative assets and
`/common/...` imports, and regenerate a preview when the change affects it.

For path or storage changes, test the development defaults and temporary
`WEBSKIN_THEMES_ROOT` and `WEBSKIN_SETTINGS_PATH` values.

Review root status before handoff. Keep generated files and unrelated changes
out of the final change.

