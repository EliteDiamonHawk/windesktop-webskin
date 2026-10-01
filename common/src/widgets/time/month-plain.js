// Plain calendar view in the shared time widget category.
import { Widget } from "../widgets.js?v=calendar-date-5";
import {
  calendarDateState,
  createCalendarFormatters,
  dateKey,
  getMonthGrid,
  getRollingMonthGrid,
  localizedMonth,
  localizedWeekday,
  localeWeekStartsOn,
  normalizeDate,
  resolveLocale,
  resolveHighlightDate,
  resolveMonthLock,
  resolveMonthMaxWeeks,
  weekdayOrder,
  watchCurrentDate,
} from "./calendar-data.js?v=calendar-date-5";

const STYLE_ID = "webskin-calendar-month-plain-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-calendar--month-plain {
      align-items: stretch;
      box-sizing: border-box;
      display: inline-flex;
      flex-direction: column;
      justify-content: center;
      width: var(--webskin-calendar-width, 22rem);
      height: var(--webskin-calendar-height, 20rem);
      min-width: 0;
      min-height: 0;
    }
    .webskin-calendar--month-plain[data-webskin-calendar-max-weeks="5"] {
      height: var(--webskin-calendar-height, 18rem);
    }
    .webskin-calendar--month-plain [data-webskin-calendar-part="weekday-headings"],
    .webskin-calendar--month-plain [data-webskin-calendar-part="month-grid"] {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
    }
    .webskin-calendar--month-plain [data-webskin-calendar-part="weekday-heading"],
    .webskin-calendar--month-plain [data-webskin-calendar-part="date-cell"] {
      min-width: 2ch;
      padding: .25rem;
      text-align: center;
    }
    .webskin-calendar--month-plain [data-webskin-calendar-part="date-cell"] {
      display: flex;
      flex-direction: column;
    }
  `;
  document.head.append(style);
};

const createPart = (part, text = "", tag = "span") => {
  const element = document.createElement(tag);
  element.dataset.webskinCalendarPart = part;
  element.textContent = text;
  return element;
};

const applyDateState = (element, date, inMonth, highlightDate) => {
  const state = calendarDateState(date, inMonth, highlightDate);
  element.dataset.webskinCalendarDate = state.date;
  element.dataset.webskinCalendarWeekday = state.weekday;
  element.dataset.webskinCalendarWeekdayIndex = String(state.weekdayIndex);
  element.dataset.webskinCalendarToday = String(state.today);
  element.dataset.webskinCalendarInMonth = String(state.inMonth);
  element.dateTime = state.date;
};

const createCell = (date, inMonth, formatters, highlightDate) => {
  const cell = document.createElement("time");
  cell.dataset.webskinCalendarPart = "date-cell";
  const day = createPart("day", String(date.getDate()));
  cell.append(day);
  applyDateState(cell, date, inMonth, highlightDate);
  return cell;
};

class PlainMonth extends Widget {
  constructor(options = {}) {
    ensureStyles();
    const {
      date: suppliedDate,
      locale: suppliedLocale,
      weekStartsOn,
      lockDay,
      maxWeeks: suppliedMaxWeeks,
      highlightDate: suppliedHighlightDate,
      className = "",
    } = options;

    const locale = resolveLocale(suppliedLocale);
    const formatters = createCalendarFormatters(locale);
    const highlightDate = resolveHighlightDate(suppliedDate, suppliedHighlightDate);
    const firstDay = localeWeekStartsOn(locale, weekStartsOn);
    const maxWeeks = resolveMonthMaxWeeks(suppliedMaxWeeks);
    const monthLock = resolveMonthLock(lockDay, maxWeeks);
    const element = document.createElement("section");
    super(element, { type: "calendar" });
    element.className = ["webskin-calendar", "webskin-calendar--month-plain", className]
      .filter(Boolean)
      .join(" ");

    const heading = createPart("month-heading", "", "header");
    const month = createPart("month");
    const year = createPart("year");
    heading.append(month, year);
    const weekdayHeadings = createPart("weekday-headings", "", "div");
    const grid = createPart("month-grid", "", "div");
    element.append(heading, weekdayHeadings, grid);

    const headingParts = [];
    for (const weekdayIndex of weekdayOrder(firstDay)) {
      const weekday = createPart("weekday-heading", localizedWeekday(weekdayIndex, formatters, "short"));
      weekday.dataset.webskinCalendarWeekday = [
        "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
      ][weekdayIndex];
      weekday.dataset.webskinCalendarWeekdayIndex = String(weekdayIndex);
      weekdayHeadings.append(weekday);
      headingParts.push(weekday);
    }

    const render = (nextDate) => {
      const anchor = normalizeDate(nextDate);
      const rollingGrid = monthLock ? getRollingMonthGrid(anchor, firstDay, monthLock, maxWeeks) : null;
      const cells = rollingGrid?.cells ?? getMonthGrid(anchor, firstDay, maxWeeks);
      element.dataset.webskinCalendarDate = dateKey(anchor);
      element.dataset.webskinCalendarMonth = `${String(anchor.getFullYear()).padStart(4, "0")}-${String(anchor.getMonth() + 1).padStart(2, "0")}`;
      element.dataset.webskinCalendarWeekStartsOn = String(firstDay);
      element.dataset.webskinCalendarMaxWeeks = String(maxWeeks);
      if (monthLock) {
        element.dataset.webskinCalendarLockY = String(monthLock.y);
        if (monthLock.x === undefined) delete element.dataset.webskinCalendarLockX;
        else element.dataset.webskinCalendarLockX = String(monthLock.x);
      } else {
        delete element.dataset.webskinCalendarLockX;
        delete element.dataset.webskinCalendarLockY;
      }
      const headingStart = rollingGrid?.start ?? cells[0].date;
      for (const [index, headingPart] of headingParts.entries()) {
        const headingDate = new Date(headingStart);
        headingDate.setDate(headingDate.getDate() + index);
        const weekdayIndex = headingDate.getDay();
        headingPart.textContent = localizedWeekday(weekdayIndex, formatters, "short");
        headingPart.dataset.webskinCalendarWeekday = [
          "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
        ][weekdayIndex];
        headingPart.dataset.webskinCalendarWeekdayIndex = String(weekdayIndex);
      }
      month.textContent = localizedMonth(anchor, formatters, "long");
      year.textContent = String(anchor.getFullYear());
      grid.replaceChildren(...cells.map(({ date, inMonth }) => createCell(date, inMonth, formatters, highlightDate)));
    };

    render(suppliedDate);
    if (suppliedDate === undefined) this.addCleanup(watchCurrentDate(render));
  }
}

/** Create a plain localized month calendar. */
export function createMonth(options = {}) {
  return new PlainMonth(options).element;
}
