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
  "widgets": {
    "clock-digital-plain": {},
    "month-prestyled": {},
    "memory-plain": {}
  }
}
```

`app` stores application keys. `themes` stores objects under a theme ID.
`widgets` stores objects under hardcoded common-widget IDs. Theme-created
widget IDs are not accepted by the widget settings routes.

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

Time widgets use one backend-resolved settings request per page load. The
backend resolves each common time widget using its widget ID before the app
family default. Invalid or missing values fall back to 5 seconds for clocks
and 60 seconds for calendars. A theme can override the backend result by
passing `updateInterval` directly to the widget constructor.

For example, constructor-level time settings use these widget IDs:

```json
{
  "themes": {
    "dev": {}
  },
  "widgets": {
    "clock-digital-plain": {
      "updateInterval": 2
    },
    "month-prestyled": {
      "updateInterval": 60
    },
    "memory-plain": {}
  }
}
```

The existing scoped settings routes can read and change these values, for
example:

```text
PUT /api/settings/widgets/clock-digital-plain/updateInterval
Body: 2
```

The time widgets query the resolved values from:

```text
GET /api/settings/widgets/time-intervals
```

The response preserves the `clock` and `calendar` app-family values and adds
resolved values under `widgets` for each common time widget.

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

Scoped routes accept `themes` and the hardcoded common-widget IDs under
`widgets`. Unknown widget IDs and missing values return `404`.
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

