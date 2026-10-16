# WinDesktop WebSkin agent guide

Use this guide before changing code across the frontend, backend, theme
runtime, or Windows host. The [documentation index](docs/README.md) links to
the detailed references.

## Boundaries

- `frontend/` contains the Astro dashboard.
- `backend/` contains the FastAPI service, filesystem access, settings, API
  routes, and runtime asset serving.
- `common/` and `themes/` contain Vite source projects. Their builds write
  browser files to `localdata/` during development.
- `wv2wall/` is a Git submodule outside the pnpm workspace. Use its
  [`README.md`](wv2wall/README.md) when you work in that project.

Use the page that matches your change:

- [Architecture](docs/architecture.md)
- [Theme runtime](docs/theme-runtime.md)
- [Theme API](docs/theme-api.md)
- [Settings and storage](docs/settings-and-storage.md)
- [Widgets](docs/widgets.md)
- [Previews](docs/previews.md)
- [Contributing](docs/contributing.md)

Use stop-slop if updating docs.

## Rules

- Keep browser URLs and response keys stable unless you plan a migration.
- Resolve runtime roots with `get_theme_paths()`.
- Validate package assets with `safe_asset_path()` and
  `UserThemeStorage.content_path()`.
- Treat `metadata.json` and `index.html` as the theme package boundary.
- Write settings, metadata, and previews through the existing atomic storage
  paths.
- Encode theme IDs with `encodeURIComponent(themeId)` in browser URLs.
- Keep HTTP validation and error translation in route handlers. Put filesystem
  and business logic in service modules.
- Use `apply_patch`. Preserve unrelated working-tree changes.
- Keep credentials, settings, caches, package stores, and build output out of
  commits.
- Do not keep legacy, or old support, as the project has not yet been published.

## Checks

Do not run developement, frontend or backend, as there will be insufficient permissions
