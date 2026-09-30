
# Backend

From this directory, run `pnpm dev` to start the reload-enabled API on
`http://127.0.0.1:8000`.

The health endpoint is available at `/api/health` and the API docs at `/docs`.

Runtime browser assets are served from `/common/*` and `/themes/<theme-id>/*`.
Their filesystem roots are resolved centrally in `webskin.paths`: repository
`themes/` during development and the WinDesktop WebSkin directory under
`LOCALAPPDATA` in production.
