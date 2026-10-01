# Settings and storage

## File format

The settings file uses version `1` and three namespaces:

```json
{
  "version": 1,
  "app": {},
  "themes": {},
  "widgets": {}
}
```

`app` stores application keys. `themes` and `widgets` store objects under an
identifier such as a theme ID or widget ID.

## Routes

| Method | Path | Action |
| --- | --- | --- |
| `GET` | `/api/settings/app` | Read app settings |
| `GET` | `/api/settings/app/{key}` | Read one app value |
| `PUT` | `/api/settings/app/{key}` | Write one app value from a JSON body |
| `DELETE` | `/api/settings/app/{key}` | Delete one app value |
| `GET` | `/api/settings/{namespace}/{id}` | Read a scoped namespace |
| `GET` | `/api/settings/{namespace}/{id}/{key}` | Read one scoped value |
| `PUT` | `/api/settings/{namespace}/{id}/{key}` | Write one scoped value |
| `DELETE` | `/api/settings/{namespace}/{id}/{key}` | Delete one scoped value |

Scoped namespaces accept `themes` and `widgets`. Missing values return `404`.
Storage failures return `503`.

## File locations

Development uses:

```text
localdata/settings.json
```

Production and frozen runs use:

```text
%LOCALAPPDATA%/WinDesktopWebskin/settings.json
```

Set `WEBSKIN_SETTINGS_PATH` to choose another file.

Theme files use a different root. See [Theme runtime](theme-runtime.md) for
`WEBSKIN_THEMES_ROOT` and environment selection.

## Writes

The JSON storage checks the version and namespace shapes before it returns data.
For writes, it creates a temporary file beside the target, flushes and syncs
the file, then replaces the target. Keep this sequence when you change the
storage code.
