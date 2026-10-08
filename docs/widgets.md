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
`/common/fonts/Anurati.otf` and `/common/fonts/Quicksand.otf`. Place the source
font files in `common/src/fonts/` before building. Its root supports the
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

System rows default to `format: "{label} {value} {unit}"`. Use `{label}`,
`{value}`, and `{unit}` placeholders to customize the text while retaining
the label, value, and unit DOM parts:

```js
createMemory({ format: "{label}: {value} {unit}" });
```

Unitless values omit the unused unit spacing.

```js
import { createMemory, createCpuUtilization } from "/common/widgets/system/index.js";

document.querySelector("#memory").append(createMemory());
document.querySelector("#cpu").append(createCpuUtilization({ interval: 2000 }));
```

Available plain constructors:

| Module | Function |
| --- | --- |
| `system/cpu-utilization-plain.js` | `createCpuUtilization(options)` |
| `system/cpu-core-counts-plain.js` | `createCpuCoreCounts(options)` |
| `system/cpu-frequencies-plain.js` | `createCpuFrequencies(options)` |
| `system/cpu-telemetry-plain.js` | `createCpuTelemetry(options)` |
| `system/cpu-load-average-plain.js` | `createCpuLoadAverage(options)` |
| `system/memory-plain.js` | `createMemory(options)` |
| `system/swap-plain.js` | `createSwap(options)` |
| `system/disk-partitions-plain.js` | `createDiskPartitions(options)` |
| `system/disk-usage-plain.js` | `createDiskUsage(options)` |
| `system/disk-io-plain.js` | `createDiskIo(options)` |
| `system/network-telemetry-plain.js` | `createNetworkTelemetry(options)` |
| `system/hardware-sensors-plain.js` | `createHardwareSensors(options)` |

Plain system widgets expose `data-webskin-system-part` hooks and keep colors,
surfaces, borders, and layout decisions available to the theme. Unsupported
platform metrics render as `Unavailable`; widgets do not fabricate values.
Hardware sensor support depends on what the operating system exposes.

Network telemetry is aggregate-only. It does not expose IP addresses, MAC
addresses, hostnames, interface identifiers, process data, usernames, serial
numbers, or other identifying metadata.
