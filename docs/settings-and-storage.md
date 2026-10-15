# Settings and storage

## File format

The settings file uses version `1` and three namespaces:

```json
{
  "version": 1,
  "app": {
    "hardware_monitor_enabled": true,
    "time_clock_update_interval_seconds": 5,
    "time_calendar_update_interval_seconds": 60
  },
  "themes": {},
  "widgets": {}
}
```

`app` stores application keys. `themes` and `widgets` store objects under an
identifier such as a theme ID or widget ID.

Set `app.hardware_monitor_enabled` to `false` to skip LibreHardwareMonitor
initialization and sensor fallback:

```json
"app": {
  "hardware_monitor_enabled": false
}
```

The backend enables the monitor when the key is absent or invalid. It reads the
key during startup, so restart FastAPI after editing `settings.json`.
`psutil` metrics continue to work when the monitor is disabled.

Time widgets use `app.time_clock_update_interval_seconds` and
`app.time_calendar_update_interval_seconds` as their family defaults. A
widget-level `updateInterval` option takes precedence. Both values must be
positive integers in seconds; invalid or missing values fall back to 5 seconds
for clocks and 60 seconds for calendars.

## Routes

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/settings/app` | Read app settings |
| `GET` | `/api/settings/app/{key}` | Read one app value |
| `PUT` | `/api/settings/app/{key}` | Write one app value from a JSON body |
| `DELETE` | `/api/settings/app/{key}` | Delete one app value |
| `GET` | `/api/settings/{namespace}/{id}` | Read one scoped namespace |
| `GET` | `/api/settings/{namespace}/{id}/{key}` | Read one scoped value |
| `PUT` | `/api/settings/{namespace}/{id}/{key}` | Write one scoped value |
| `DELETE` | `/api/settings/{namespace}/{id}/{key}` | Delete one scoped value |

Scoped routes accept `themes` and `widgets`. Missing values return `404`.
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

Theme packages use a separate root. See [Theme runtime](theme-runtime.md) for
`WEBSKIN_THEMES_ROOT` and environment selection.

## Writes

The JSON storage validates the version and namespace shapes when it loads the
file. For each write, it creates a temporary file beside the target, flushes
and syncs the file, then replaces the target. Keep that sequence in storage
changes.

