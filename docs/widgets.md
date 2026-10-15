# Shared widgets

Shared widgets live under `/common/widgets/`. Each module returns a DOM or SVG
root element. A theme chooses the parent element and provides CSS.

## Lifecycle

The shared `Widget` class owns timers and listeners. Returned elements can
expose `destroy()`. Call it before removing an element:

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
| Rainmeter Mond remake | `/common/widgets/time/rainmeter-mond-clock-remake.js` | `createClock(options)` |

Digital clocks accept `format` (`12h` or `24h`), `seconds`,
`showPeriod`, `syntax`, `offsetMinutes`, `updateInterval`, and `className`.
Analog clocks accept `offsetMinutes`, `smooth`, `updateInterval`, and
`className`. Pre-styled clocks accept `color` and `backgroundColor` where
their module defines them. `updateInterval` is a positive integer number of
seconds. The clock default is 5 seconds; set it to 1 for per-second updates.
When omitted, the persisted app setting
`time_clock_update_interval_seconds` is used when available.

Use `data-webskin-clock-part` to style `hours`, `minutes`, `seconds`,
`period`, `face`, `tick`, `hour-hand`, `minute-hand`,
`second-hand`, and `pin`.

The Rainmeter Mond remake loads its fonts from
`/common/assets/fonts/Anurati.otf` and `/common/assets/fonts/Quicksand.otf`.
The source files live in `common/src/assets/fonts/`. Its root supports these
custom properties:

```text
--webskin-mond-color
--webskin-mond-width
--webskin-mond-weekday-size
--webskin-mond-detail-size
--webskin-mond-gap
```

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

- `date`: a local `Date` or local `YYYY-MM-DD` string. Omit it to use the browser's local date.
- `highlightDate`: the date that receives the today state.
- `updateInterval`: a positive integer number of seconds between current-date checks. The calendar default is 60 seconds; when omitted, the persisted app setting `time_calendar_update_interval_seconds` is used when available.
- `locale`: an `Intl` locale. The browser locale supplies the default.
- `className`: extra classes for the theme.
- `weekStartsOn`: an explicit week-start index.
- `daysBefore` and `daysAfter`: a seven-day window. Their sum must equal six.
- `lockDay`: a month anchor `{ y, x? }`. `y` is required; `x` is optional.
- `maxWeeks`: the month-grid height in rows, from 1 through 6. The default is 6.
- `format`: date tokens such as `YYYY`, `MMMM`, `ddd`, `MM`, and `DD`.

Calendar elements expose `data-webskin-calendar-part`,
`data-webskin-calendar-date`, `data-webskin-calendar-in-month`, and
`data-webskin-calendar-today` where the module supports each field. The
widgets use local dates and do not convert them to UTC.

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

Calendar pre-styled widgets use:

```text
--webskin-calendar-color
--webskin-calendar-background
--webskin-calendar-border
--webskin-calendar-today-background
--webskin-calendar-today-color
--webskin-calendar-adjacent-opacity
```

## System telemetry

System widgets live under `/common/widgets/system/` and read the
privacy-filtered snapshot from `/api/system/metrics`. Each constructor accepts
`className`, `endpoint`, and `interval`. Format-capable widgets also accept
`format`. The default interval is five seconds.

The metrics manager owns polling. Widgets with the same endpoint and interval
share one request, and the request asks for the union of their fields. Destroy a
widget with `element.destroy?.()` to unsubscribe it and stop its polling.

Formats use named brace tokens. Literal labels, punctuation, whitespace, units,
and percent signs remain literal. The escapes `\\n`, `\\r`, `\\t`, and
`\\\\` work in format strings. Dynamic tokens become elements with
`data-webskin-system-format-part`; literals remain text nodes.

Before the first successful poll, tokens render as `-`. Missing, unsupported,
or unavailable values render as `n/a`. Boolean values render as `true` or
`false`.

```js
import {
  createBattery,
  createMemory,
  createNetworkTelemetryTransfer,
} from "/common/widgets/system/index.js";

document.querySelector("#battery").append(createBattery());
document.querySelector("#memory").append(
  createMemory({ format: "Used: {used} {used-unit}\\nUsage: {usage} %" }),
);
document.querySelector("#network").append(createNetworkTelemetryTransfer());
```

The system constructors are:

```text
createBattery
createCpuUtilization
createCpuUtilizationList
createCpuCoreCounts
createCpuFrequency
createCpuTelemetry
createCpuLoadAverage
createMemory
createSwapMemory
createDiskIo
createNetworkTelemetry
createDiskPartitions
createGpuThermalFan
createNetworkTelemetryTransfer
```

The CPU utilization list repeats one format line for the overall value and each
core. Its limit ignores non-positive values. Set `zeroIndex: true` to label
cores from Core 0; labels start at Core 1 by default.

Byte values use separate value and unit tokens such as `{used}` and
`{used-unit}`. The formatter scales them with binary units. Write fixed units
such as MHz, ms, %, °C, and RPM in the format.

`createSwapMemory({ metric: "total" | "used" | "free" | "usage" })` selects
one scalar value. Without `metric`, it renders the full swap summary.
`createDiskPartitions` accepts an optional `mountPoint` and uses the first
local partition when omitted. `createGpuThermalFan` accepts `sensorId` and
`gpuId`; `sensorId` wins when both exist.

GPU readings depend on HardwareMonitor and available drivers. The provider must
expose a distinct warning threshold before a widget can show one. Network
widgets expose aggregate counters only. They do not expose addresses, interface
IDs, hostnames, usernames, process data, or other identifying metadata.
Transfer speeds use successful aggregate counter samples. Utilization uses
`n/a` because the backend does not know link capacity.

