// Plain calendar view in the shared time widget category.
import { Widget } from "../widgets.js";
import {
  addDays,
  calendarDateState,
  createCalendarFormatters,
  dateKey,
  getWeekDays,
  getRollingWeekDays,
  localizedMonth,
  localizedWeekday,
  localeWeekStartsOn,
  normalizeDate,
  resolveLocale,
  resolveWeekWindow,
  startOfWeek,
  watchCurrentDate,
} from "./calendar-data.js";

const STYLE_ID = "webskin-calendar-week-plain-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-calendar--week-plain [data-webskin-calendar-part="week"] {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
    }
    .webskin-calendar--week-plain [data-webskin-calendar-part="date-cell"] {
      display: flex;
      flex-direction: column;
      min-width: 2ch;
      padding: .25rem;
      text-align: center;
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
  element.dateTime = state.date;
};

const createCell = (date, formatters) => {
  const cell = document.createElement("time");
  cell.dataset.webskinCalendarPart = "date-cell";
  const weekday = createPart("weekday");
  const day = createPart("day");
  const month = createPart("month");
  cell.append(weekday, day, month);
  renderCell(cell, { weekday, day, month }, date, formatters);
  return { cell, parts: { weekday, day, month } };
};

const renderCell = (cell, parts, date, formatters) => {
  applyDateState(cell, date);
  parts.weekday.textContent = localizedWeekday(date.getDay(), formatters, "short");
  parts.weekday.dataset.webskinCalendarToday = cell.dataset.webskinCalendarToday;
  parts.day.textContent = String(date.getDate());
  parts.month.textContent = localizedMonth(date, formatters, "short");
};

class PlainWeek extends Widget {
  constructor(options = {}) {
    ensureStyles();
    const {
      date: suppliedDate,
      locale: suppliedLocale,
      weekStartsOn,
      daysBefore,
      daysAfter,
      className = "",
    } = options;

    const locale = resolveLocale(suppliedLocale);
    const formatters = createCalendarFormatters(locale);
    const firstDay = localeWeekStartsOn(locale, weekStartsOn);
    const rollingWindow = resolveWeekWindow(daysBefore, daysAfter);
    const element = document.createElement("div");
    super(element, { type: "calendar" });
    element.className = ["webskin-calendar", "webskin-calendar--week-plain", className]
      .filter(Boolean)
      .join(" ");

    const grid = createPart("week");
    element.append(grid);
    const cells = [];

    const render = (nextDate) => {
      const anchor = normalizeDate(nextDate);
      const days = rollingWindow
        ? getRollingWeekDays(anchor, rollingWindow.daysBefore)
        : getWeekDays(anchor, firstDay);
      const start = days[0];
      element.dataset.webskinCalendarDate = dateKey(anchor);
      element.dataset.webskinCalendarStartDate = dateKey(start);
      element.dataset.webskinCalendarEndDate = dateKey(addDays(start, 6));
      element.dataset.webskinCalendarWeekStartsOn = String(firstDay);
      if (rollingWindow) {
        element.dataset.webskinCalendarDaysBefore = String(rollingWindow.daysBefore);
        element.dataset.webskinCalendarDaysAfter = String(rollingWindow.daysAfter);
      } else {
        delete element.dataset.webskinCalendarDaysBefore;
        delete element.dataset.webskinCalendarDaysAfter;
      }
      for (const cell of cells) cell.cell.remove();
      cells.length = 0;
      for (const day of days) {
        const nextCell = createCell(day, formatters);
        cells.push(nextCell);
        grid.append(nextCell.cell);
      }
    };

    render(suppliedDate);
    if (suppliedDate === undefined) this.addCleanup(watchCurrentDate(render));
  }
}

/** Create a plain seven-day calendar week. */
export function createWeek(options = {}) {
  return new PlainWeek(options).element;
}
