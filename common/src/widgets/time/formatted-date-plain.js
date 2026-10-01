// Plain calendar view in the shared time widget category.
import { Widget } from "../widgets.js?v=calendar-date-5";
import {
  calendarDateState,
  createCalendarFormatters,
  dateKey,
  mediumDateSegments,
  normalizeDate,
  parseDateFormat,
  resolveLocale,
  resolveHighlightDate,
  tokenPart,
  tokenValue,
  watchCurrentDate,
} from "./calendar-data.js?v=calendar-date-5";

const STYLE_ID = "webskin-calendar-formatted-date-plain-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-calendar--formatted-date-plain {
      align-items: baseline;
      box-sizing: border-box;
      display: inline-flex;
      width: var(--webskin-calendar-width, 20rem);
      height: var(--webskin-calendar-height, 3.5rem);
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

const applyDateState = (element, date, highlightDate) => {
  const state = calendarDateState(date, true, highlightDate);
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
      highlightDate: suppliedHighlightDate,
      locale: suppliedLocale,
      format,
      className = "",
    } = options;

    const locale = resolveLocale(suppliedLocale);
    const formatters = createCalendarFormatters(locale);
    const highlightDate = resolveHighlightDate(suppliedDate, suppliedHighlightDate);
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
      applyDateState(element, current, highlightDate);
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
