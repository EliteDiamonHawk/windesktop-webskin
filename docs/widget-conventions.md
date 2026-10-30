# Widget conventions

Use these rules when adding or changing widgets under `common/src/widgets/`.

## Factory and root

Export a factory with an options object and return one DOM or SVG root:

```js
export function createExample(options = {}) {
  const element = document.createElement("section");
  const widget = new Widget(element, { type: "example", variant: "plain" });
  widget.setState("ready");
  return element;
}
```

The returned root owns its runtime. `destroy()` must stop timers, polling,
animation frames, listeners, observers, and child widgets. Register cleanup with
`Widget.addCleanup()`.

Use `data-webskin-widget` for family, `data-webskin-widget-variant` for
`plain` or `prestyled`, and `data-webskin-widget-state` for lifecycle state.
Async system roots also expose `data-webskin-system-state`. Timer roots use
`data-webskin-timer-state` for domain state such as `paused`, `running`, and
`finished`.

## Classes and structure

Use these root classes:

```text
webskin-{family}
webskin-{family}--{kind}
webskin-{family}--plain | webskin-{family}--prestyled
```

Keep specific kind classes when they provide CSS hooks. Accept `className` and
normalize whitespace through shared DOM helpers.

Expose stable internal structure with `data-webskin-*-part`. Update text and
attributes in place. Do not recreate stable nodes during normal polling or date
changes. Reuse rows and cells; add or remove nodes only when collection size
changes.

Use semantic elements where possible: `time` for dates and times, `button` for
actions, `output` for status, and `section` for compound widgets.

## Plain and pre-styled widgets

Plain widgets expose structure and behavior. Pre-styled widgets add surfaces,
colors, typography, assets, and frame layout.

Both variants must share renderers and controllers. A pre-styled factory may
provide its final root and content nodes to shared runtime code, but it must not
create a detached live plain widget and synchronize it later.

The final returned root must own:

- `destroy()`
- lifecycle and domain state
- polling and animation cleanup
- documented imperative methods
- documented `data-*` hooks

Use `smallWidgetFrame()` for small cards. Update `parts.value`,
`parts.subtext`, and `parts.actions` directly. Use shared masked-asset helpers
for icons and shape masks.

## Polling and time

Use `updateInterval` as positive integer seconds. Do not add millisecond
interval aliases. Settings resolve defaults when the option is omitted; an
explicit option wins.

Use shared managers:

- `time-scheduler.ts` for clocks, calendars, and animation frames
- `system/metrics/client.ts` for system snapshots
- `time/timers/timers.ts` for system-time synchronization

Register every returned unsubscribe function with the owning `Widget`.

## Loading, errors, and methods

Render initial fallback content synchronously. System values use `-` before the
first successful snapshot and `n/a` for missing ready values. Set lifecycle state
to `initial`, `ready`, or `error` on the root.

Expose only methods supported by widget type. Use consistent names and return
the root when methods are chainable. Do not expose silent no-op methods.

Composite widgets must destroy every child through parent cleanup.

## Styles

Inject structural styles once with shared style helpers. Style IDs must be
stable. Guard style injection when `document` or `document.head` is absent.

Use CSS custom properties for dimensions, colors, spacing, and other theme
inputs. Keep theme selectors on documented root classes and data parts.

## New-widget checklist

- Factory accepts `options = {}` and returns one root.
- Root constructs `Widget` and exposes `destroy()`.
- Root sets family, kind, variant, and lifecycle state hooks.
- `className` works with multiple whitespace-separated classes.
- Stable parts use `data-webskin-*-part`.
- `updateInterval` uses seconds and shared scheduler/manager.
- Initial render works before async data arrives.
- Cleanup stops all asynchronous work.
- Pre-styled version shares runtime with plain version.
- Tests cover initial render, updates, destroy, validation, and public methods.

