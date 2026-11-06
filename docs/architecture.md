# Architecture

## Components

- `dashboard/` contains the Vite dashboard. It loads user themes through the API.
- `backend/` contains the ASP.NET Core service. It owns settings, theme files, HTTP routes, and asset serving.
- `common/` contains shared browser modules. Its Vite build writes `localdata/common/`.
- `dev/themes/` contains built-in theme source. Its Vite build writes `localdata/themes/dev/`.

## Request flow

Vite listens on port `4321`. Its proxy sends `/api`, `/common`, and `/themes`
requests to ASP.NET Core on port `8000`.

```text
Browser -> Vite proxy -> ASP.NET Core
```

ASP.NET Core serves a theme from `/themes/{theme_id}/`. The theme imports shared
modules from `/common/`, creates widget elements in its document, and owns its
CSS.

## Backend modules

- `Program.cs` configures ASP.NET Core, CORS, services, and middleware.
- `Api/Endpoints.cs` validates HTTP input and maps service errors to response codes.
- `Services/SettingsService.cs` provides settings access.
- `Infrastructure/JsonSettingsStorage.cs` reads and writes settings JSON atomically.
- `Services/ThemeStorage.cs` manages theme packages and previews.
- `Infrastructure/Paths.cs` selects runtime roots and rejects asset escapes.
- `Metrics/` owns metric collection, caching, subscriptions, and hardware sensors.

## Runtime roots

`ThemePaths` exposes two directories below one selected root:

- `common_root` serves `/common/...`.
- `theme_root` serves `/themes/{theme_id}/...`.

Call `get_theme_paths()` when code needs these paths. See [Theme runtime](theme-runtime.md)
for root selection and [Settings and storage](settings-and-storage.md) for the
settings file.

