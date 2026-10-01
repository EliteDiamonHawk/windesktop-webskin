# Theme and asset API

FastAPI serves these routes under `/api`. The Astro development server proxies
the same paths to port `8000`.

## Service checks

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/health` | `{ "status": "ok", "service": "backend" }` |
| `GET` | `/api/status` | Frontend/backend connection message |

## Theme routes

| Method | Path | Body or result |
| --- | --- | --- |
| `GET` | `/api/themes` | List routable themes |
| `POST` | `/api/themes` | Body: `{ "name": "..." }` |
| `POST` | `/api/themes/{id}/duplicate` | Copy a bundled or user theme |
| `PATCH` | `/api/themes/{id}` | Body: `{ "name": "..." }` |
| `DELETE` | `/api/themes/{id}` | Delete a theme |
| `PUT` | `/api/themes/{id}/preview` | Body: `{ "png": "data:image/png;base64,..." }` |
| `GET` | `/api/themes/{id}/preview` | Return `preview.png` |

Theme responses use these fields:

```json
{
  "id": "Example",
  "name": "Example",
  "entry_url": "/themes/Example/",
  "preview": "/themes/Example/assets/images/preview.svg"
}
```

The `preview` value can be `null` when the package has no preview. A generated
PNG uses `/api/themes/{id}/preview`. Encode theme IDs with
`encodeURIComponent()` before inserting them into browser URLs.

## Asset routes

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/common/{path}` | Shared module or asset |
| `GET` | `/themes/{id}` or `/themes/{id}/` | Package `index.html` |
| `GET` | `/themes/{id}/{path}` | Package asset |

Asset requests stay inside the configured root. Missing files, invalid paths,
and invalid packages return `404`.

## Status codes

- `422`: invalid request body or preview data
- `404`: missing theme, preview, or asset
- `409`: rename conflict
- `503`: storage unavailable

Route handlers validate HTTP input and map service errors to status codes.
Service modules handle filesystem and theme logic.
