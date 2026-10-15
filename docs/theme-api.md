# Theme and asset API

FastAPI serves these routes under `/api`. Astro proxies the same paths to
port `8000` during development.

## Service checks

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/health` | `{ "status": "ok", "service": "backend" }` |
| `GET` | `/api/status` | Frontend/backend connection message |

## System telemetry

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/system/metrics` | Privacy-filtered CPU, memory, disk, aggregate network, and sensor data |

Add a comma-separated `fields` query parameter to request a subset:

```text
/api/system/metrics?fields=memory.virtual.used_bytes,memory.virtual.percent
```

The backend skips unrequested capability calls. It keeps the response groups and
sets unrequested values to `null`. Without `fields`, it returns the full
snapshot.

The response contains `timestamp`, `cpu`, `memory`, `disks`, `network`,
and `sensors`. Each metric group has an `available` boolean. Unsupported
values use `null`. The backend includes local mount points and omits remote and
UNC mounts.

`sensors.temperatures` and `sensors.fans` keep their existing shapes.
`sensors.readings` contains normalized readings from `psutil` or
LibreHardwareMonitor:

```json
{
  "id": "cpu/0/temperature/0",
  "hardware_id": "cpu/0",
  "hardware_name": "CPU",
  "hardware_type": "cpu",
  "name": "Package",
  "type": "temperature",
  "value": 47.5,
  "unit": "°C",
  "minimum": 40.0,
  "maximum": 80.0,
  "warning": null,
  "critical": 95.0,
  "source": "hardware_monitor"
}
```

The normalized `type` supports temperatures, fans, voltages, power, current,
clocks and frequencies, loads, battery levels, storage sensors, and other
LibreHardwareMonitor readings. `sensors.battery` contains a normalized battery
summary when the system provides one.

The browser metrics manager requests fields referenced by widget formats. It
derives network transfer speeds from successive byte-counter samples. The
backend does not return transfer speeds or network utilization because it has no
link-capacity value.

HardwareMonitor is optional. Some Windows motherboard and system sensors need
the PawnIO driver and suitable privileges. Missing drivers, denied access,
unsupported sensors, and initialization errors mark the sensor group
unavailable while FastAPI keeps running.

Network data contains aggregate byte, drop, and error counters. It does not
contain addresses, interface IDs, hostnames, or other network identity data.

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

The `preview` field is `null` when the package has no preview. A generated
PNG uses `/api/themes/{id}/preview`. Encode theme IDs with
`encodeURIComponent(themeId)` before putting them in browser URLs.

## Asset routes

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/common/{path}` | Shared module or asset |
| `GET` | `/themes/{id}` or `/themes/{id}/` | Package `index.html` |
| `GET` | `/themes/{id}/{path}` | Package asset |

Asset requests stay inside the configured root. Missing files, invalid paths,
and invalid packages return `404`.

## Status codes

- `422`: invalid request body, field list, or preview data
- `404`: missing theme, preview, or asset
- `409`: rename conflict
- `503`: storage unavailable

Route handlers validate HTTP input and translate service errors. Service modules
handle filesystem and theme logic.

