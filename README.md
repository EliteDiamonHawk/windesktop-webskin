# WinDesktop WebSkin

WinDesktop WebSkin provides a browser-based desktop for Windows.

## Start developing

Install these tools:

- Node.js `>=22.12.0`
- Python `3.14` and `uv`
- `pnpm`

Run from the repository root:

```bash
pnpm install
pnpm dev
```

Open the dashboard at `http://localhost:4321`. FastAPI listens at
`http://127.0.0.1:8000`. Check the service at
`http://127.0.0.1:8000/api/health`.

## Repository layout

- `dashboard/`: Astro dashboard
- `backend/`: FastAPI service
- `common/`: shared browser modules and widgets
- `dev/themes/`: built-in theme source
- `localdata/`: generated runtime files and local data
- `wv2wall/`: Windows and WebView2 host

Read the [documentation index](docs/README.md) for setup, development, themes,
the API, widgets, and storage. Read the [`wv2wall` guide](wv2wall/README.md)
for the Windows host.

