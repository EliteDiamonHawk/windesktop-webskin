# Settings and storage

## File format

Settings use version `1` namespace files. The settings directory contains
`app.json`, `themes.json`, and `widgets.json`. The widget index points to one
file per configured widget under the `widgets/` subdirectory:

```json
settings/
|-- app.json
|-- themes.json
|-- widgets.json
`-- widgets/
    `-- memory-plain.json
```

`app.json` stores application keys and `themes.json` stores objects under theme
IDs. `widgets.json` stores the widget index:

```json
{
  "version": 1,
  "widgets": {
    "memory-plain": {
      "file": "widgets/memory-plain.json"
    }
  }
}
```

Each indexed widget file has its own ID and settings object:

```json
{
  "version": 1,
  "id": "memory-plain",
  "settings": {
    "updateInterval": 15
  }
}
```

Widget files are created on the first write. An uninitialized widget reads as
an empty settings object and does not create a file. Settings routes accept any
safe widget ID. Deleting the last setting keeps the empty widget file and its
index entry.

Set `app.hardware_monitor_enabled` to `false` to skip LibreHardwareMonitor
initialization and sensor fallback:

```json
"app": {
  "hardware_monitor_enabled": false
}
```

The backend enables the monitor when the key is absent or invalid. It reads the
key during startup, so restart FastAPI after editing `app.json`.
`psutil` metrics continue to work when the monitor is disabled.

Time widgets use one backend-resolved settings request per page load. The
backend resolves each common time widget using its widget ID before the app
family default. Invalid or missing values fall back to 5 seconds for clocks
and 60 seconds for calendars. A theme can override the backend result by
passing `updateInterval` directly to the widget constructor.

For example, constructor-level time settings use these widget IDs and files:

`settings/widgets.json`:

```json
{
  "version": 1,
  "widgets": {
    "digital-plain": {
      "file": "widgets/digital-plain.json"
    },
    "month-prestyled": {
      "file": "widgets/month-prestyled.json"
    }
  }
}
```

`settings/widgets/digital-plain.json`:

```json
{
  "version": 1,
  "id": "digital-plain",
  "settings": {
    "updateInterval": 2
  }
}
```

`settings/widgets/month-prestyled.json`:

```json
{
  "version": 1,
  "id": "month-prestyled",
  "settings": {
    "updateInterval": 60
  }
}
```

The existing scoped settings routes can read and change these values, for
example:

```text
PUT /api/settings/widgets/digital-plain/updateInterval
Body: 2
```

The time widgets query the resolved values from:

```text
GET /api/settings/widgets/time-intervals
```

The response preserves the `clock` and `calendar` app-family values and adds
resolved values under `widgets` for each common time widget.

System widgets use three app-level polling families. The defaults are 5 seconds
for fast telemetry (CPU utilization, disk I/O, network, and GPU sensors), 30
seconds for standard metrics (memory, swap, battery, CPU frequency, CPU
telemetry, and load average), and 60 seconds for slow metrics (CPU counts and
disk partitions). The app keys are
`system_fast_update_interval_seconds`,
`system_standard_update_interval_seconds`, and
`system_slow_update_interval_seconds`.

System widget values resolve from:

```text
GET /api/settings/widgets/system-intervals
```

The response contains `fast`, `standard`, `slow`, and resolved `widgets`
values. A widget-level `widgets/{widget-id}/updateInterval` value overrides its
family default. Invalid or missing values use the family default.

System constructors also accept `updateInterval` in seconds, following the
time-widget API. The existing `interval` option remains supported in
milliseconds and takes precedence when both options are supplied.

## Routes

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/settings/app` | Read app settings |
| `GET` | `/api/settings/app/{key}` | Read one app value |
| `PUT` | `/api/settings/app/{key}` | Write one app value from a JSON body |
| `DELETE` | `/api/settings/app/{key}` | Delete one app value |
| `GET` | `/api/settings/widgets/time-intervals` | Resolve time-widget intervals |
| `GET` | `/api/settings/widgets/system-intervals` | Resolve system-widget intervals |
| `GET` | `/api/settings/{namespace}/{id}` | Read one scoped namespace |
| `GET` | `/api/settings/{namespace}/{id}/{key}` | Read one scoped value |
| `PUT` | `/api/settings/{namespace}/{id}/{key}` | Write one scoped value |
| `DELETE` | `/api/settings/{namespace}/{id}/{key}` | Delete one scoped value |

Scoped routes accept `themes` and safe widget IDs under `widgets`. Missing
settings return `404`; uninitialized widget namespaces read as empty objects.
Storage failures return `503`.

## File locations

Development uses:

```text
localdata/settings/
```

Production and frozen runs use:

```text
%LOCALAPPDATA%/WinDesktopWebskin/settings/
```

Set `WEBSKIN_SETTINGS_PATH` to choose another settings directory. The backend
creates `app.json`, `themes.json`, `widgets.json`, and `widgets/` there when
they are missing. The old single `settings.json` format is not read or
migrated.

Theme packages use a separate root. See [Theme runtime](theme-runtime.md) for
`WEBSKIN_THEMES_ROOT` and environment selection.

## Writes

The JSON storage validates versions, namespace shapes, widget IDs, and indexed
paths when it loads a file. For each write, it creates a temporary file beside
the target, flushes and syncs the file, then replaces the target. A first widget
write replaces the widget file before it updates `widgets.json`, so the index
never points to a file that was not written.

