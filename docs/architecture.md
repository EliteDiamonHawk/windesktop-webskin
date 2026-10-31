# Architecture

## Components

- `dashboard/` contains the Astro dashboard. It renders the built-in `dev` card and loads user themes through the API.
- `backend/` contains the FastAPI service. It owns settings, theme files, HTTP routes, and asset serving.
- `common/` contains shared browser modules. Its Vite build writes `localdata/common/`.
- `themes/` contains built-in theme source. Its Vite build writes `localdata/themes/dev/`.
- `wv2wall/` contains the Windows host and its own build process.

## Request flow

Astro listens on port `4321`. Its proxy sends `/api`, `/common`, and `/themes`
requests to FastAPI on port `8000`.

```text
Browser -> Astro proxy -> FastAPI
```

FastAPI serves a theme from `/themes/{theme_id}/`. The theme imports shared
modules from `/common/`, creates widget elements in its document, and owns its
CSS.

## Backend modules

- `main.py` creates the FastAPI app, lifespan, CORS settings, and health routes.
- `routes.py` validates HTTP input and maps service errors to response codes.
- `settings.py` provides the settings service.
- `persistence.py` reads and writes versioned namespace JSON plus per-widget files.
- `themes.py` manages theme packages and previews.
- `paths.py` selects runtime roots and rejects asset escapes.
- `system_metrics.py` collects the privacy-filtered system snapshot.
- `hardware_monitor.py` reads optional LibreHardwareMonitor sensors.

## Runtime roots

`ThemePaths` exposes two directories below one selected root:

- `common_root` serves `/common/...`.
- `theme_root` serves `/themes/{theme_id}/...`.

Call `get_theme_paths()` when code needs these paths. See [Theme runtime](theme-runtime.md)
for root selection and [Settings and storage](settings-and-storage.md) for the
settings file.

