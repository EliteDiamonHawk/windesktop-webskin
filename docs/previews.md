# Theme previews

`GET /api/themes` returns a preview URL for each routable theme. The backend
checks these files in order:

1. A generated `preview.png` at the package root.
2. An authored preview at the package root.
3. An authored preview under `assets/images/`.

The authored filenames are `preview.png`, `preview.jpeg`, `preview.jpg`,
`preview.svg`, `preview.webp`, and `preview.gif`.

## Save a generated preview

Send a PNG data URL to the preview route:

```http
PUT /api/themes/{theme_id}/preview
Content-Type: application/json

{ "png": "data:image/png;base64,..." }
```

The backend validates the data URL and PNG signature, writes `preview.png`
with an atomic replace, and removes a root-level `preview.svg`. The generated
PNG then wins preview selection. `GET /api/themes/{theme_id}/preview` returns
that file as `image/png`.

## Dashboard behavior

The dashboard reload action adds a cache-busting query parameter to the current
preview URL and waits for the image to decode. The dashboard does not capture a
theme page.

A capture client must render `/themes/{theme_id}/` as a standalone page, load
relative package assets and `/common/...` modules, then send the PNG data URL to
the preview route.

