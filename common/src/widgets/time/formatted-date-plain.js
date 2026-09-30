// Plain calendar view in the shared time widget category.
import { Widget } from "../widgets.js";
import {
  calendarDateState,
  createCalendarFormatters,
  dateKey,
  mediumDateSegments,
  normalizeDate,
  parseDateFormat,
  resolveLocale,
  tokenPart,
  tokenValue,
  watchCurrentDate,
} from "./calendar-data.js";

const STYLE_ID = "webskin-calendar-formatted-date-plain-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-calendar--formatted-date-plain {
      display: inline-flex;
      align-items: baseline;
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

const applyDateState = (element, date) => {
  const state = calendarDateState(date);
  element.dataset.webskinCalendarDate = state.date;
  element.dataset.webskinCalendarWeekday = state.weekday;
  element.dataset.webskinCalendarWeekdayIndex = String(state.weekdayIndex);
  element.dataset.webskinCalendarToday = String(state.today);
  element.dataset.webskinCalendarInMonth = String(state.inMonth);
};

class PlainFormattedDate extends Widget {
  constructor(options = {}) {
    ensureStyles();
    const {
      date: suppliedDate,
      locale: suppliedLocale,
      format,
      className = "",
    } = options;

    const locale = resolveLocale(suppliedLocale);
    const formatters = createCalendarFormatters(locale);
    const element = document.createElement("time");
    super(element, { type: "calendar" });
    element.className = ["webskin-calendar", "webskin-calendar--formatted-date-plain", className]
      .filter(Boolean)
      .join(" ");

    const segments = format === undefined
      ? mediumDateSegments(normalizeDate(suppliedDate), formatters).map((segment) => ({
        ...segment,
        element: createPart(segment.part, segment.value),
      }))
      : parseDateFormat(format).map((segment) => ({
        ...segment,
        element: createPart(segment.type === "token" ? tokenPart(segment.value) : "separator"),
      }));
    element.append(...segments.map(({ element: part }) => part));

    const render = (nextDate) => {
      const current = normalizeDate(nextDate);
      for (const segment of segments) {
        segment.element.textContent = segment.type === "token"
          ? tokenValue(segment.value, current, formatters)
          : format === undefined
            ? formatters.medium.formatToParts(current)[segment.index]?.value ?? segment.value
            : segment.value;
      }
      element.dateTime = dateKey(current);
      applyDateState(element, current);
      element.setAttribute("aria-label", formatters.medium.format(current));
    };

    render(suppliedDate);
    if (suppliedDate === undefined) this.addCleanup(watchCurrentDate(render));
  }
}

/** Create a locale-aware plain formatted date with theme-owned styling. */
export function createDate(options = {}) {
  return new PlainFormattedDate(options).element;
}
