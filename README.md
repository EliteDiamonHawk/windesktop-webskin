# desktop-webskin
# WinDesktop Webskin

## Development

Install the frontend dependencies and start both services from the root:

```bash
pnpm install
pnpm dev
```

The frontend runs at `http://localhost:4321` and proxies `/api` to the backend
at `http://127.0.0.1:8000`.

To run services separately:

```bash
pnpm dev:frontend
pnpm dev:backend
```

The backend health endpoint is `http://127.0.0.1:8000/api/health`.
