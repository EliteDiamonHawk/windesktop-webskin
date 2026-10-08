import { createClock as createPlainClock } from "/common/widgets/time/clock-digital-plain.js";
import { createClock as createPlainAnalogClock } from "/common/widgets/time/clock-analog-plain.js";
import { createClock as createDigitalClock } from "/common/widgets/time/clock-digital-prestyled.js";
import { createClock as createDigitalDayClock } from "/common/widgets/time/clock-digital-day.js";
import { createClock as createAnalogClock } from "/common/widgets/time/clock-analog-prestyled.js";
import { createClock as createAnalogClock2 } from "/common/widgets/time/clock-analog-prestyled2.js";
import { createClock as createDigitalAnalogClock } from "/common/widgets/time/clock-digital-analog-prestyled.js";
import { createDay } from "/common/widgets/time/day-plain.js";
import { createWeek } from "/common/widgets/time/week-plain.js";
import { createMonth } from "/common/widgets/time/month-plain.js";
import { createDay as createPrestyledDay } from "/common/widgets/time/day-prestyled.js";
import { createDay as createPrestyledDay2 } from "/common/widgets/time/day-prestyled2.js";
import { createWeek as createPrestyledWeek } from "/common/widgets/time/week-prestyled.js";
import { createMonth as createPrestyledMonth } from "/common/widgets/time/month-prestyled.js";

const clockGallery = document.querySelector("#clock-gallery");
const calendarGallery = document.querySelector("#calendar-gallery");
let mounted = [];

const clockExamples = [
  ["Digital plain", createPlainClock, {}, 1.5],
  ["Digital pre-styled", createDigitalClock, {}, 1.25],
  ["Digital day", createDigitalDayClock, {}, 1],
  ["Analog plain", createPlainAnalogClock, {}, 1.1],
  ["Analog pre-styled", createAnalogClock, {}, 1],
  ["Analog pre-styled 2", createAnalogClock2, {}, 1],
  ["Digital and analog pre-styled", createDigitalAnalogClock, {}, 1],
];

const calendarExamples = [
  ["Formatted day, plain", createDay, {}, 1.25],
  ["Single day, plain", createDay, { variant: "single-day" }, 1.1],
  ["Formatted day, pre-styled", createPrestyledDay, {}, 1],
  ["Single day, pre-styled", createPrestyledDay2, {}, 1],
  ["Week, plain, natural", createWeek, {}, 1],
  ["Week, plain, rolling 3/3", createWeek, { daysBefore: 3, daysAfter: 3 }, 1],
  ["Week, pre-styled, natural", createPrestyledWeek, {}, 1],
  ["Week, pre-styled, rolling 3/3", createPrestyledWeek, { daysBefore: 3, daysAfter: 3 }, 1],
];

for (const [maxWeeks, weekLabel] of [[5, "5 weeks"], [6, "6 weeks"]]) {
  calendarExamples.push(
    [`Month, plain, unlocked, ${weekLabel}`, createMonth, { maxWeeks }, 1],
    [`Month, plain, row locked, ${weekLabel}`, createMonth, { maxWeeks, lockDay: { y: 2 } }, 1],
    [`Month, plain, cell locked, ${weekLabel}`, createMonth, { maxWeeks, lockDay: { x: 3, y: 2 } }, 1],
    [`Month, pre-styled, unlocked, ${weekLabel}`, createPrestyledMonth, { maxWeeks }, 1],
    [`Month, pre-styled, row locked, ${weekLabel}`, createPrestyledMonth, { maxWeeks, lockDay: { y: 2 } }, 1],
    [`Month, pre-styled, cell locked, ${weekLabel}`, createPrestyledMonth, { maxWeeks, lockDay: { x: 3, y: 2 } }, 1],
  );
}

const createExample = ([label, createWidget, options = {}, scale = 1]) => {
  const example = document.createElement("section");
  example.className = "widget-example";

  const heading = document.createElement("h3");
  heading.textContent = label;

  const stage = document.createElement("div");
  stage.className = "widget-example__stage";
  stage.style.setProperty("--widget-scale", String(scale));

  const widget = createWidget(options);
  stage.append(widget);
  example.append(heading, stage);
  return { example, widget };
};

const mountExamples = (target, examples) => {
  const fragment = document.createDocumentFragment();
  const widgets = [];
  for (const definition of examples) {
    const { example, widget } = createExample(definition);
    fragment.append(example);
    widgets.push(widget);
  }
  target.replaceChildren(fragment);
  mounted = widgets;
};

const unmount = () => {
  mounted.splice(0).forEach((widget) => widget.destroy?.());
  clockGallery?.replaceChildren();
  calendarGallery?.replaceChildren();
};

const showPage = (page) => {
  unmount();
  if (page === "clocks" && clockGallery) mountExamples(clockGallery, clockExamples);
  if (page === "calendars" && calendarGallery) mountExamples(calendarGallery, calendarExamples);
};

document.addEventListener("webskin:showcase-page-change", (event) => showPage(event.detail.page));

if (!document.querySelector('[data-showcase-panel="clocks"]')?.hidden) showPage("clocks");
