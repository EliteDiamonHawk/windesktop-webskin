// Plain calendar view in the shared time widget category.
import { Widget } from "../widgets.js";
import {
  calendarDateState,
  createCalendarFormatters,
  dateKey,
  localizedMonth,
  localizedWeekday,
  normalizeDate,
  resolveLocale,
  watchCurrentDate,
} from "./calendar-data.js";

const STYLE_ID = "webskin-calendar-single-day-plain-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-calendar--single-day-plain {
      display: inline-flex;
      flex-direction: column;
    }
  `;
  document.head.append(style);
};

const createPart = (part, text = "") => {
  const element = document.createElement("span");
  element.dataset.webskinCalendarPart = part;
  element.textContent = text;
  return element;
};

const renderDateParts = (parts, date, formatters) => {
  const state = calendarDateState(date);
  parts.weekday.textContent = localizedWeekday(date.getDay(), formatters, "long");
  parts.day.textContent = String(date.getDate());
  parts.month.textContent = localizedMonth(date, formatters, "long");
  parts.year.textContent = String(date.getFullYear());
  parts.root.dateTime = dateKey(date);
  parts.root.dataset.webskinCalendarDate = state.date;
  parts.root.dataset.webskinCalendarWeekday = state.weekday;
  parts.root.dataset.webskinCalendarWeekdayIndex = String(state.weekdayIndex);
  parts.root.dataset.webskinCalendarToday = String(state.today);
  parts.root.dataset.webskinCalendarInMonth = String(state.inMonth);
  parts.root.setAttribute("aria-label", formatters.medium.format(date));
};

class PlainSingleDay extends Widget {
  constructor(options = {}) {
    ensureStyles();
    const {
      date: suppliedDate,
      locale: suppliedLocale,
      className = "",
    } = options;

    const locale = resolveLocale(suppliedLocale);
    const formatters = createCalendarFormatters(locale);
    const element = document.createElement("time");
    super(element, { type: "calendar" });
    element.className = ["webskin-calendar", "webskin-calendar--single-day-plain", className]
      .filter(Boolean)
      .join(" ");

    const parts = {
      root: element,
      weekday: createPart("weekday"),
      day: createPart("day"),
      month: createPart("month"),
      year: createPart("year"),
    };
    element.append(parts.weekday, parts.day, parts.month, parts.year);

    const render = (nextDate) => renderDateParts(parts, normalizeDate(nextDate), formatters);
    render(suppliedDate);
    if (suppliedDate === undefined) this.addCleanup(watchCurrentDate(render));
  }
}

/** Create a plain visual representation of one calendar date. */
export function createDay(options = {}) {
  return new PlainSingleDay(options).element;
}
