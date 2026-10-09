// Plain calendar view in the shared time widget category.
import { Widget } from "../widgets.js?v=month-widget-1";
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
  resolveHighlightDate,
  resolveLocale,
  resolveMonthLock,
  resolveMonthMaxWeeks,
  weekdayOrder,
  watchCurrentDate,
} from "./calendar-data.js?v=month-widget-1";

const STYLE_ID = "webskin-calendar-month-plain-styles";
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

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
    .webskin-calendar--month-plain [data-webskin-calendar-part="month-grid"] {
      flex: 1 1 auto;
      grid-template-rows: repeat(var(--webskin-calendar-weeks), minmax(0, 1fr));
      min-height: 0;
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
      min-height: 0;
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

const updateDateState = (element, date, inMonth, highlightDate) => {
  const state = calendarDateState(date, inMonth, highlightDate);
  element.dataset.webskinCalendarDate = state.date;
  element.dataset.webskinCalendarWeekday = state.weekday;
  element.dataset.webskinCalendarWeekdayIndex = String(state.weekdayIndex);
  element.dataset.webskinCalendarToday = String(state.today);
  element.dataset.webskinCalendarInMonth = String(state.inMonth);
  element.dateTime = state.date;
};

const createCell = () => {
  const cell = document.createElement("time");
  cell.dataset.webskinCalendarPart = "date-cell";
  const day = createPart("day");
  cell.append(day);
  return { cell, day };
};

const updateCell = (parts, date, inMonth, highlightDate) => {
  parts.day.textContent = String(date.getDate());
  updateDateState(parts.cell, date, inMonth, highlightDate);
};

const setWeekdayState = (element, weekdayIndex, formatters) => {
  element.textContent = localizedWeekday(weekdayIndex, formatters, "short");
  element.dataset.webskinCalendarWeekday = DAY_NAMES[weekdayIndex];
  element.dataset.webskinCalendarWeekdayIndex = String(weekdayIndex);
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
    element.style.setProperty("--webskin-calendar-weeks", String(maxWeeks));

    const heading = createPart("month-heading", "", "header");
    const month = createPart("month");
    const year = createPart("year");
    heading.append(month, year);

    const weekdayHeadings = createPart("weekday-headings", "", "div");
    const weekdayParts = weekdayOrder(firstDay).map((weekdayIndex) => {
      const weekday = createPart("weekday-heading");
      setWeekdayState(weekday, weekdayIndex, formatters);
      weekdayHeadings.append(weekday);
      return weekday;
    });

    const grid = createPart("month-grid", "", "div");
    const cells = Array.from({ length: maxWeeks * 7 }, createCell);
    grid.append(...cells.map(({ cell }) => cell));
    element.append(heading, weekdayHeadings, grid);

    const render = (nextDate) => {
      const anchor = normalizeDate(nextDate);
      const rollingGrid = monthLock ? getRollingMonthGrid(anchor, firstDay, monthLock, maxWeeks) : null;
      const monthGrid = rollingGrid?.cells ?? getMonthGrid(anchor, firstDay, maxWeeks);
      const headingStart = rollingGrid?.start ?? monthGrid[0].date;

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

      for (const [index, weekdayPart] of weekdayParts.entries()) {
        const headingDate = new Date(headingStart);
        headingDate.setDate(headingDate.getDate() + index);
        setWeekdayState(weekdayPart, headingDate.getDay(), formatters);
      }

      month.textContent = localizedMonth(anchor, formatters, "long");
      year.textContent = String(anchor.getFullYear());
      for (const [index, cellParts] of cells.entries()) {
        const cell = monthGrid[index];
        updateCell(cellParts, cell.date, cell.inMonth, highlightDate);
      }
    };

    render(suppliedDate);
    if (suppliedDate === undefined) this.addCleanup(watchCurrentDate(render));
  }
}

/** Create a plain localized month calendar. */
export function createMonth(options = {}) {
  return new PlainMonth(options).element;
}
