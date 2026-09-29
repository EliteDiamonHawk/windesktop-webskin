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

## Theme runtime

Themes are runtime assets, not framework-specific source projects. An installed
theme must provide `metadata.json` and `index.html`; it may also include CSS,
JavaScript, and assets. Framework-based themes should be built before they are
installed. The host does not run theme package managers or build commands.

User theme content is served from `/api/themes/{theme_id}/content/`, so relative
asset URLs in `index.html` work without any React, Astro, Tailwind, or pnpm
requirement.

Theme IDs are the final theme names. Names are unique case-insensitively; when
needed, creation automatically chooses names such as `Theme`, `Theme 2`, and
`Theme 3`.
