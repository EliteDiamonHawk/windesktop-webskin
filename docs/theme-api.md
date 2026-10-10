# Theme and asset API

FastAPI serves these routes under `/api`. The Astro development server proxies
the same paths to port `8000`.

## Service checks

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/health` | `{ "status": "ok", "service": "backend" }` |
| `GET` | `/api/status` | Frontend/backend connection message |

## System telemetry

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/system/metrics` | Privacy-filtered local CPU, memory, disk, aggregate network, and sensor snapshot |

The metrics route accepts an optional comma-separated `fields` query parameter,
such as `?fields=memory.virtual.used_bytes,memory.virtual.percent`. When it is
present, the backend skips unrequested capability calls and returns the same
response groups with unrequested values as `null`. Without `fields`, the route
returns the complete snapshot.

The response contains `timestamp`, `cpu`, `memory`, `disks`, `network`, and
`sensors` objects. Metric groups include an `available` boolean and use
`null` for values unsupported by the operating system. Disk usage is returned
only for backend-reported local mount points; remote/UNC mounts are omitted.
`sensors.temperatures` and `sensors.fans` retain their existing shapes.
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

The normalized `type` can represent temperatures, fans, voltages, power,
current, clocks/frequencies, loads, battery levels, storage sensors, and
other sensor types reported by LibreHardwareMonitor. `sensors.battery` is a
normalized battery summary when available.

The browser system-metrics manager requests only fields referenced by widget
formats. Network transfer speeds are derived in the browser from successive
successful aggregate byte-counter samples; they are not backend response
fields. Network utilization remains unavailable because no link capacity is
known.

HardwareMonitor is optional at runtime. Some Windows motherboard and system
sensors require the PawnIO driver and appropriate privileges; missing drivers,
permissions, unsupported sensors, and initialization failures produce an
unavailable sensor group without preventing the backend from starting.

Network data contains aggregate byte,
drop, and error counters only; it does not contain addresses, interface
identifiers, hostnames, or other network identity data.

System widget formats use brace tokens and are polled by one shared browser
metrics manager. The canonical exports are createBattery,
createCpuUtilization, createCpuUtilizationList, createCpuCoreCounts,
createCpuFrequency, createCpuTelemetry, createCpuLoadAverage, createMemory,
createSwapMemory, createDiskIo, createNetworkTelemetry,
createDiskPartitions, createGpuThermalFan, and
createNetworkTelemetryTransfer. Transfer speeds are derived client-side and
GPU warning thresholds remain unavailable unless the provider exposes them.

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
