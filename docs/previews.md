# Theme previews

`GET /api/themes` returns the preview URL for each theme. The backend checks
for a generated `preview.png`, then checks the package root and
`assets/images/` for authored preview files.

## Save a generated preview

Send a PNG data URL to the preview route:

```http
PUT /api/themes/{theme_id}/preview
Content-Type: application/json

{ "png": "data:image/png;base64,..." }
```

The backend writes `preview.png` with an atomic replace. It removes an old
root-level `preview.svg`, so the generated PNG takes priority. The matching
`GET` route returns that PNG.

## Dashboard behavior

The dashboard's reload action adds a cache-busting query parameter to the
existing preview image and waits for the image to decode. The dashboard does
not capture a theme page at this point.

A capture client must render `/themes/{theme_id}/` as a standalone page, load
relative package assets and `/common/...` modules, then send the PNG data URL
to the backend. The backend validates the data and stores the file.
