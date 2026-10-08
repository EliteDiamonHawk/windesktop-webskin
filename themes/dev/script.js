import { createClock as createPlainClock } from "/common/widgets/time/digital-plain.js";
import { createClock as createPlainAnalogClock } from "/common/widgets/time/analog-plain.js";
import { createClock as createDigitalClock } from "/common/widgets/time/digital-prestyled.js";
import { createClock as createAnalogClock } from "/common/widgets/time/analog-prestyled.js";
import { createClock as createAnalogClock2 } from "/common/widgets/time/analog-prestyled2.js";
import { createClock as createDigitalAnalogClock } from "/common/widgets/time/digital-analog-prestyled.js";
import { createDate } from "/common/widgets/time/formatted-date-plain.js?v=calendar-date-5";
import { createDay } from "/common/widgets/time/single-day-plain.js?v=calendar-date-5";
import { createWeek } from "/common/widgets/time/week-plain.js?v=calendar-date-5";
import { createMonth } from "/common/widgets/time/month-plain.js?v=calendar-date-5";
import { createDate as createPrestyledDate } from "/common/widgets/time/formatted-date-prestyled.js?v=calendar-date-5";
import { createDay as createPrestyledDay } from "/common/widgets/time/single-day-prestyled.js?v=calendar-date-5";
import { createWeek as createPrestyledWeek } from "/common/widgets/time/week-prestyled.js?v=calendar-date-5";
import { createMonth as createPrestyledMonth } from "/common/widgets/time/month-prestyled.js?v=calendar-date-5";


document.querySelector("#clock").append(createPlainClock());
document.querySelector("#analog-plain-clock").append(createPlainAnalogClock());
document.querySelector("#digital-clock").append(createDigitalClock());
document.querySelector("#analog-clock").append(createAnalogClock());
document.querySelector("#analog-clock-2").append(createAnalogClock2({
  size: "9rem",
}));

document.querySelector("#combination-clock").append(createDigitalAnalogClock({
}));

document.querySelector("#formatted-date").append(createDate({
  format: "dddd, MMMM D, YYYY",
}));
document.querySelector("#single-day").append(createDay());
document.querySelector("#calendar-week").append(createWeek({ daysBefore: 1, daysAfter: 5 }));
document.querySelector("#calendar-month").append(createMonth({ maxWeeks: 5 }));
const calendarDateOutput = document.querySelector("[data-calendar-current-date]");
const calendarShiftButtons = document.querySelectorAll("[data-calendar-shift]");
const calendarTodayButton = document.querySelector("[data-calendar-today]");
let prestyledCalendarDate = new Date();

const dateInputValue = (date) => (
  `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
);

const shiftCalendarDate = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  next.setHours(12, 0, 0, 0);
  return next;
};

const renderPrestyledCalendars = () => {
  const widgets = [
    ["#formatted-date-prestyled", createPrestyledDate({ date: prestyledCalendarDate, format: "ddd, MMM D, YYYY" })],
    ["#single-day-prestyled", createPrestyledDay({ date: prestyledCalendarDate })],
    ["#calendar-week-prestyled-unlocked", createPrestyledWeek({ date: prestyledCalendarDate })],
    ["#calendar-week-prestyled-locked", createPrestyledWeek({ date: prestyledCalendarDate, daysBefore: 3, daysAfter: 3 })],
    // Keep this unlocked month at five weeks; it intentionally never uses the six-week default.
    ["#calendar-month-prestyled-unlocked", createPrestyledMonth({ date: prestyledCalendarDate, maxWeeks: 5 })],
    ["#calendar-month-prestyled-row-locked", createPrestyledMonth({ date: prestyledCalendarDate, maxWeeks: 5, lockDay: { y: 2 } })],
    ["#calendar-month-prestyled-cell-locked", createPrestyledMonth({ date: prestyledCalendarDate, maxWeeks: 5, lockDay: { x: 3, y: 2 } })],
  ];
  for (const [selector, widget] of widgets) {
    document.querySelector(selector)?.replaceChildren(widget);
  }
  if (calendarDateOutput) {
    calendarDateOutput.value = dateInputValue(prestyledCalendarDate);
    calendarDateOutput.textContent = prestyledCalendarDate.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
};

calendarShiftButtons.forEach((button) => {
  button.addEventListener("click", () => {
    prestyledCalendarDate = shiftCalendarDate(prestyledCalendarDate, Number(button.dataset.calendarShift));
    renderPrestyledCalendars();
  });
});
calendarTodayButton?.addEventListener("click", () => {
  prestyledCalendarDate = new Date();
  renderPrestyledCalendars();
});
renderPrestyledCalendars();

const editor = document.querySelector("#clock-editor");
const preview = document.querySelector("#editor-preview");
const resetButton = document.querySelector("[data-reset-editor]");
const defaults = {
  variant: "digital",
  format: "24h",
  color: "#cfb5ab",
  background: "#5b4841",
  frame: "#5b4841",
  size: "2.7",
  radius: "12",
  padding: "12",
  spacing: "8",
  seconds: true,
  period: true,
};

const field = (name) => editor?.elements.namedItem(name);

const syncOutputs = () => {
  if (!editor) return;
  const size = field("size");
  const radius = field("radius");
  const padding = field("padding");
  const spacing = field("spacing");
  const output = (name, value) => {
    const outputElement = editor.querySelector(`[data-output="${name}"]`);
    if (outputElement) outputElement.textContent = value;
  };
  output("size", `${size.value}rem`);
  output("radius", `${radius.value}px`);
  output("padding", `${padding.value}px`);
  output("spacing", `${(Number(spacing.value) / 100).toFixed(2)}em`);
};

const renderEditorClock = () => {
  if (!editor || !preview) return;
  const values = new FormData(editor);
  const variant = values.get("variant");
  const format = values.get("format");
  const size = `${values.get("size")}rem`;
  const padding = `${values.get("padding")}px`;
  const clockOptions = {
    format,
    seconds: values.get("seconds") === "on",
    showPeriod: values.get("period") === "on",
    color: values.get("color"),
  };
  const clock = variant === "plain"
    ? createPlainClock(clockOptions)
    : variant === "analog"
      ? createAnalogClock(clockOptions)
      : createDigitalClock(clockOptions);
  clock.style.color = values.get("color");
  clock.style.backgroundColor = values.get("background");
  clock.style.borderColor = values.get("frame");
  clock.style.borderRadius = `${values.get("radius")}px`;
  clock.style.fontSize = size;
  clock.style.letterSpacing = `${Number(values.get("spacing")) / 100}em`;
  clock.style.padding = padding;
  if (variant === "analog") {
    clock.style.width = size;
    clock.style.height = size;
    clock.style.setProperty("--webskin-analog-color", values.get("color"));
    clock.style.setProperty("--webskin-analog-face", values.get("background"));
    clock.style.setProperty("--webskin-analog-frame", values.get("frame"));
    clock.style.setProperty("--webskin-analog-second-hand-display", clockOptions.seconds ? "inline" : "none");
  }
  preview.replaceChildren(clock);
  syncOutputs();
};

const setEditorDefaults = () => {
  if (!editor) return;
  for (const [name, value] of Object.entries(defaults)) {
    const input = field(name);
    if (!input) continue;
    if (input.type === "checkbox") input.checked = value;
    else input.value = value;
  }
  renderEditorClock();
};

editor?.addEventListener("input", renderEditorClock);
editor?.addEventListener("change", renderEditorClock);
resetButton?.addEventListener("click", setEditorDefaults);
setEditorDefaults();
