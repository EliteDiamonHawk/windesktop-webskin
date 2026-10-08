// Plain calendar day view in the shared time widget category.
import { Widget } from "../widgets.js?v=calendar-date-5";
import {
  calendarDateState,
  createCalendarFormatters,
  localizedMonth,
  localizedWeekday,
  mediumDateSegments,
  normalizeDate,
  parseDateFormat,
  resolveLocale,
  resolveHighlightDate,
  tokenPart,
  tokenValue,
  watchCurrentDate,
} from "./calendar-data.js?v=calendar-date-5";

const STYLE_ID = "webskin-calendar-day-plain-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-calendar--day-plain[data-webskin-calendar-variant="formatted"] {
      align-items: baseline;
      box-sizing: border-box;
      display: inline-flex;
      width: var(--webskin-calendar-width, 20rem);
      height: var(--webskin-calendar-height, 3.5rem);
      min-width: 0;
      min-height: 0;
    }
    .webskin-calendar--day-plain[data-webskin-calendar-variant="single-day"] {
      box-sizing: border-box;
      display: inline-flex;
      flex-direction: column;
      width: var(--webskin-calendar-width, 14rem);
      height: var(--webskin-calendar-height, 10rem);
      min-width: 0;
      min-height: 0;
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

const resolveVariant = (variant) => {
  if (variant === "formatted" || variant === "single-day") return variant;
  throw new TypeError('Day variant must be "formatted" or "single-day"');
};

const applyDateState = (element, date, highlightDate) => {
  const state = calendarDateState(date, true, highlightDate);
  element.dateTime = state.date;
  element.dataset.webskinCalendarDate = state.date;
  element.dataset.webskinCalendarWeekday = state.weekday;
  element.dataset.webskinCalendarWeekdayIndex = String(state.weekdayIndex);
  element.dataset.webskinCalendarToday = String(state.today);
  element.dataset.webskinCalendarInMonth = String(state.inMonth);
};

class PlainDay extends Widget {
  constructor(options = {}) {
    ensureStyles();
    const {
      date: suppliedDate,
      highlightDate: suppliedHighlightDate,
      locale: suppliedLocale,
      format,
      variant: suppliedVariant = "formatted",
      className = "",
    } = options;

    const variant = resolveVariant(suppliedVariant);
    const locale = resolveLocale(suppliedLocale);
    const formatters = createCalendarFormatters(locale);
    const highlightDate = resolveHighlightDate(suppliedDate, suppliedHighlightDate);
    const element = document.createElement("time");
    super(element, { type: "calendar" });
    element.className = ["webskin-calendar", "webskin-calendar--day-plain", className]
      .filter(Boolean)
      .join(" ");
    element.dataset.webskinCalendarVariant = variant;

    let render;
    if (variant === "single-day") {
      const parts = {
        weekday: createPart("weekday"),
        day: createPart("day"),
        month: createPart("month"),
        year: createPart("year"),
      };
      element.append(parts.weekday, parts.day, parts.month, parts.year);
      render = (nextDate) => {
        const current = normalizeDate(nextDate);
        parts.weekday.textContent = localizedWeekday(current.getDay(), formatters, "long");
        parts.day.textContent = String(current.getDate());
        parts.month.textContent = localizedMonth(current, formatters, "long");
        parts.year.textContent = String(current.getFullYear());
        applyDateState(element, current, highlightDate);
        element.setAttribute("aria-label", formatters.medium.format(current));
      };
    } else {
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

      render = (nextDate) => {
        const current = normalizeDate(nextDate);
        for (const segment of segments) {
          segment.element.textContent = segment.type === "token"
            ? tokenValue(segment.value, current, formatters)
            : format === undefined
              ? formatters.medium.formatToParts(current)[segment.index]?.value ?? segment.value
              : segment.value;
        }
        applyDateState(element, current, highlightDate);
        element.setAttribute("aria-label", formatters.medium.format(current));
      };
    }

    render(suppliedDate);
    if (suppliedDate === undefined) this.addCleanup(watchCurrentDate(render));
  }
}

/** Create a locale-aware plain calendar day. */
export function createDay(options = {}) {
  return new PlainDay(options).element;
}
