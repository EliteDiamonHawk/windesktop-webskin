import { Widget } from "../widgets.js";
import { createClock as createPlainClock } from "./clock-digital-plain.js";
import { createDay as createPlainDay } from "./day-plain.js?v=calendar-date-5";

const STYLE_ID = "webskin-clock-digital-day-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-clock--digital-day {
      --webskin-clock-color: #d6d6d6;
      --webskin-clock-background: #2e2e2e;
      align-items: center;
      background: var(--webskin-clock-background);
      border: 1px solid var(--webskin-clock-background);
      border-radius: .75rem;
      box-sizing: border-box;
      box-shadow: 0 .75rem 2rem rgb(0 0 0 / .18);
      color: var(--webskin-clock-color);
      display: inline-flex;
      flex-direction: column;
      font-family: "Segoe UI", Arial, sans-serif;
      justify-content: center;
      padding: var(--webskin-clock-padding, .8rem .65rem);
      width: var(--webskin-clock-width, 8rem);
      height: var(--webskin-clock-height, 13rem);
      min-width: 0;
      min-height: 0;
    }
    .webskin-clock--digital-day__content {
      align-items: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      transform: translateY(var(--webskin-clock-content-offset, .75rem));
    }
    .webskin-clock--digital-day [data-webskin-clock-part="hours"],
    .webskin-clock--digital-day [data-webskin-clock-part="minutes"] {
      color: var(--webskin-clock-color);
      font-size: var(--webskin-clock-digit-size, 4.25rem);
      font-weight: 600;
      letter-spacing: -.08em;
      line-height: .84;
    }
    .webskin-clock--digital-day .webskin-clock--digital-plain {
      display: contents;
      width: auto;
      height: auto;
    }
    .webskin-clock--digital-day .webskin-calendar--day-plain {
      align-items: center;
      color: var(--webskin-clock-color);
      display: inline-flex;
      font-size: var(--webskin-clock-date-size, .95rem);
      font-weight: 500;
      justify-content: center;
      line-height: 1;
      margin-top: .7rem;
      width: auto;
      height: auto;
    }
  `;
  document.head.append(style);
};

/** Create a pre-styled stacked digital clock with the current day below it. */
export function createClock(options = {}) {
  ensureStyles();
  const {
    date,
    locale,
    dateFormat = "ddd, MM/DD",
    className = "",
    color,
    backgroundColor,
    ...clockOptions
  } = options;

  const element = document.createElement("section");
  const widget = new Widget(element, { type: "clock" });
  element.className = ["webskin-clock", "webskin-clock--digital-day", className]
    .filter(Boolean)
    .join(" ");
  element.setAttribute("aria-label", "Current time and date");
  if (color) element.style.setProperty("--webskin-clock-color", color);
  if (backgroundColor) element.style.setProperty("--webskin-clock-background", backgroundColor);

  const hours = createPlainClock({ ...clockOptions, format: "24h", seconds: false, showPeriod: false, syntax: "HH" });
  const minutes = createPlainClock({ ...clockOptions, format: "24h", seconds: false, showPeriod: false, syntax: "mm" });
  const day = createPlainDay({ date, locale, format: dateFormat });
  const content = document.createElement("div");
  content.className = "webskin-clock--digital-day__content";
  content.append(hours, minutes, day);
  element.append(content);

  widget.addCleanup(() => {
    hours.destroy?.();
    minutes.destroy?.();
    day.destroy?.();
  });
  return element;
}
