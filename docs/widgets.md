# Shared widgets

Shared widgets live under `/common/widgets/`. Each module returns a DOM or SVG
root element. Your theme chooses the parent element and the CSS.

## Lifecycle

The shared `Widget` class owns timers and listeners. A returned element can
expose `destroy()`. Call it before you remove the element:

```js
const clock = createClock();
document.querySelector("#clock").append(clock);
clock.destroy?.();
```

## Clocks

| Module | Import | Function |
| --- | --- | --- |
| Digital plain | `/common/widgets/time/clock-digital-plain.js` | `createClock(options)` |
| Digital pre-styled | `/common/widgets/time/clock-digital-prestyled.js` | `createClock(options)` |
| Analog plain | `/common/widgets/time/clock-analog-plain.js` | `createClock(options)` |
| Analog pre-styled | `/common/widgets/time/clock-analog-prestyled.js` | `createClock(options)` |
| Analog pre-styled 2 | `/common/widgets/time/clock-analog-prestyled2.js` | `createClock(options)` |
| Digital and analog | `/common/widgets/time/clock-digital-analog-prestyled.js` | `createClock(options)` |
| Rainmeter Mond clock remake | `/common/widgets/time/rainmeter-mond-clock-remake.js` | `createClock(options)` |

Digital clocks accept `format` (`12h` or `24h`), `seconds`, `showPeriod`,
`syntax`, `offsetMinutes`, and `className`. Analog clocks accept
`offsetMinutes`, `smooth`, and `className`. Pre-styled clocks accept `color`
and `backgroundColor` where the module defines them.

Use `data-webskin-clock-part` to style `hours`, `minutes`, `seconds`, `period`,
`face`, `tick`, `hour-hand`, `minute-hand`, `second-hand`, and `pin` parts.

The Rainmeter Mond clock remake is self-styled and loads its required fonts from
`/common/assets/fonts/Anurati.otf` and `/common/assets/fonts/Quicksand.otf`.
Place the source font files in `common/src/assets/fonts/` before building. Its root supports the
`--webskin-mond-color`, `--webskin-mond-width`,
`--webskin-mond-weekday-size`, `--webskin-mond-detail-size`, and
`--webskin-mond-gap` custom properties.

## Calendars

| Module | Import | Function |
| --- | --- | --- |
| Formatted day | `/common/widgets/time/day-plain.js` | `createDay(options)` |
| Formatted day pre-styled | `/common/widgets/time/day-prestyled.js` | `createDay(options)` |
| Single day | `/common/widgets/time/day-plain.js` | `createDay({ variant: "single-day", ...options })` |
| Single day pre-styled | `/common/widgets/time/day-prestyled2.js` | `createDay(options)` |
| Week | `/common/widgets/time/week-plain.js` | `createWeek(options)` |
| Week pre-styled | `/common/widgets/time/week-prestyled.js` | `createWeek(options)` |
| Month | `/common/widgets/time/month-plain.js` | `createMonth(options)` |
| Month pre-styled | `/common/widgets/time/month-prestyled.js` | `createMonth(options)` |

Calendar options:

- `date`: a local `Date` or local `YYYY-MM-DD` string. Omit it to follow the
  browser's local date.
- `highlightDate`: the date that receives the today state.
- `locale`: an `Intl` locale. The browser locale supplies the default.
- `className`: extra classes for your theme.
- `weekStartsOn`: an explicit week-start index.
- `daysBefore` and `daysAfter`: a seven-day window. Their sum must equal six.
- `lockDay`: a month anchor `{ y, x? }`. `y` is required; `x` is optional.
- `maxWeeks`: a month height from 1 through 6. The default is 6.
- `format`: date tokens such as `YYYY`, `MMMM`, `ddd`, `MM`, and `DD`.

Calendar elements expose `data-webskin-calendar-part`,
`data-webskin-calendar-date`, `data-webskin-calendar-in-month`, and
`data-webskin-calendar-today` where the module supports each field. The
widgets use local dates, not UTC conversion.

## CSS hooks

Plain widgets expose structure. Pre-styled widgets provide colors, surfaces,
and borders. Set size variables on the widget root:

```css
.hero-clock {
  --webskin-clock-width: 24rem;
  --webskin-clock-height: 5rem;
  --webskin-clock-font-size: 1.25em;
}

.calendar {
  --webskin-calendar-width: 30rem;
  --webskin-calendar-height: 24rem;
}
```

Default outer sizes:

| Widget | Width | Height |
| --- | --- | --- |
| Digital clock | `18ch` | `2.5em` |
| Digital and analog clock | `30rem` | `10rem` |
| Pre-styled analog clock | `10rem` | `10rem` |
| Formatted day | `20rem` | `3.5rem` |
| Single day | `14rem` | `10rem` |
| Week | `28rem` | `7rem` |
| Month | `22rem` | `20rem`, or `18rem` with `maxWeeks: 5` |

Set width or height to `auto` for content-driven sizing. Pre-styled digital
clocks use `--webskin-clock-font-size`. Pre-styled formatted days use
`--webskin-calendar-font-size`.

Calendar pre-styled widgets use these variables:

```text
--webskin-calendar-color
--webskin-calendar-background
--webskin-calendar-border
--webskin-calendar-today-background
--webskin-calendar-today-color
--webskin-calendar-adjacent-opacity
```

## System telemetry

Plain system widgets live under `/common/widgets/system/` and use the backend
snapshot at `/api/system/metrics`. Every system widget accepts `className`,
`endpoint`, `interval`, and `format` options. The default polling interval is five
seconds. Destroying the returned element aborts its request and stops its
polling timer.

Hardware readings preserve the existing temperature and fan fields while the
snapshot also exposes normalized `sensors.readings` records. Records include
their provider source and a generic sensor type, so future widgets can render
voltage, power, current, clock, load, battery, storage, or other hardware
values without depending on LibreHardwareMonitor objects. Hardware sensor
availability remains machine- and permissions-dependent.

System rows default to `format: "{label} {value} {unit}"`. Use `{label}`,
`{value}`, and `{unit}` placeholders to customize the text while retaining
the label, value, and unit DOM parts:

```js
createMemory({ format: "{label}: {value} {unit}" });
```

Unitless values omit the unused unit spacing.

```js
import { createBattery, createCpuFrequency, createDiskIo, createMemory, createMemoryList } from "/common/widgets/system/index.js";

document.querySelector("#battery").append(createBattery());
document.querySelector("#cpu").append(createCpuFrequency({ core: 0, interval: 2000 }));
document.querySelector("#disk").append(createDiskIo("read", "bytes", { format: "{label}: {value} {unit}" }));
document.querySelector("#memory").append(createMemory("used"));
document.querySelector("#legacy-memory").append(createMemoryList());
```

Scalar family constructors:

| Category | Constructors |
| --- | --- |
| Battery | `createBattery(options)` — percentage, plugged state, and seconds left |
| CPU utilization | `createCpuUtilization(variant)` — `overall`, `core` |
| CPU counts | `createCpuCoreCount(variant)` — `physical`, `logical` |
| CPU frequency | `createCpuFrequency(variant)` — `core`, `current`, `max`, `min` |
| CPU telemetry | `createCpuTelemetry(variant)` — `interrupts`, `system-calls`, `context-switches` |
| Load average | `createCpuLoadAverage(variant)` — `one-minute`, `five-minutes`, `fifteen-minutes` |
| Memory | `createMemory(variant)` — `total`, `available`, `used`, `free`, `percent` |
| Swap | `createSwap(variant)` — `total`, `used`, `free`, `percent` |
| Disk I/O | `createDiskIo(direction, metric)` — `read/write × count/bytes/time`, or `busy, time` |
| Network | `createNetworkTelemetry(variant)` — `bytes-sent`, `bytes-received`, `packets-dropped`, `transmission-errors` |
| Partitions | `createDiskPartition(variant)` — `mount-point`, `filesystem`, `mount-options` |
| Disk usage | `createDiskUsage(variant)` — `mount-point`, `total`, `used`, `free`, `percent` |
| Hardware sensors | `createHardwareSensor(variant)` — `name`, `value`, `minimum`, `maximum`, `critical` |

The first argument may be omitted and replaced with the options object. Defaults
are overall utilization, physical core count, per-core frequency, interrupts,
one-minute load, used memory, used swap, read bytes, sent bytes, disk capacity,
and sensor value. The per-core frequency and utilization variants require a
zero-based `core` option. Partition and disk-usage variants require a
`mountPoint` string. Hardware sensor variants require a stable `sensorId` from
`snapshot.sensors.readings`.

Every scalar factory renders one formatted metric row. All factories accept the
existing `className`, `endpoint`, `interval`, and `format` options. For example:

```js
createCpuFrequency("current", { format: "{label}: {value} {unit}" });
createMemory({ format: "{label}: {value} {unit}" });
```

Battery uses angle-bracket tags and defaults to
`<label> <battery-percent> <unit>`. It supports `<label>`,
`<battery-percent>`, `<unit>`, `<power-plugged>`, and `<secs-left>`;
plugged state renders as `true` or `false`, while unavailable values and
negative OS time-left sentinels render as `Unavailable`.

```js
createBattery({
  format: "<label>: <battery-percent><unit> plugged=<power-plugged> left=<secs-left>",
});
```

Canonical list constructors retain the previous multi-value presentations:

`createCpuUtilizationList`, `createCpuCoreCountsList`,
`createCpuFrequenciesList`, `createCpuTelemetryList`,
`createCpuLoadAverageList`, `createMemoryList`, `createSwapList`,
`createDiskPartitionsList`, `createDiskUsageList`, `createDiskIoList`,
`createNetworkTelemetryList`, and `createHardwareSensorsList`.

Scalar widgets use the unsuffixed family constructors above. Multi-value
widgets always use the explicit `-list` constructors; they are separate
widgets rather than compatibility aliases.

Plain system widgets expose `data-webskin-system-part` hooks and keep colors,
surfaces, borders, and layout decisions available to the theme. Unsupported
platform metrics render as `Unavailable`; widgets do not fabricate values.
Hardware sensor support depends on what the operating system exposes.

Network telemetry is aggregate-only. It does not expose IP addresses, MAC
addresses, hostnames, interface identifiers, process data, usernames, serial
numbers, or other identifying metadata.
