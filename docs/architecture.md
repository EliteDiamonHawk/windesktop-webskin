# Architecture

## Components

- `frontend/` contains the Astro dashboard. The dashboard renders the bundled
  `dev` card and loads user themes through the API.
- `backend/` contains the FastAPI service. It handles settings, theme files,
  theme routes, and asset serving.
- `common/` contains shared browser modules. Its Vite build writes files to
  `localdata/common/`.
- `themes/` contains built-in theme source. Its Vite build writes the `dev`
  package to `localdata/themes/dev/`.

## Request flow

Astro listens on port `4321`. Its proxy sends `/api`, `/common`, and `/themes`
requests to FastAPI on port `8000`.

```text
Browser -> Astro proxy -> FastAPI
```

FastAPI serves theme files below `/themes/{theme_id}/`. A theme imports shared
modules from `/common/...`, inserts widget elements into its own DOM, and owns
its CSS.

## Backend modules

- `main.py` creates the FastAPI app and health routes.
- `routes.py` defines settings, theme, and asset routes.
- `settings.py` wraps settings storage.
- `persistence.py` reads and writes versioned JSON.
- `themes.py` manages package files and previews.
- `paths.py` resolves runtime roots and blocks asset escapes.

## Runtime roots

`ThemePaths` holds two directories:

- `common_root` serves `/common/...`.
- `theme_root` serves `/themes/{theme_id}/...`.

See [Theme runtime](theme-runtime.md) for root selection. See [Settings and
storage](settings-and-storage.md) for the settings file.
