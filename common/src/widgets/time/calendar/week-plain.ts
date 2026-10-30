import { Widget } from "../../widgets.js?v=calendar-date-5";
import { classNames, rejectLegacyInterval } from "../../dom.js";
import { validateUpdateInterval } from "../time-scheduler.js";
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
  resolveHighlightDate,
  resolveWeekWindow,
  startOfWeek,
  watchCurrentDate,
} from "./calendar-data.js?v=calendar-date-5";

const STYLE_ID = "webskin-calendar-week-plain-styles";
const WIDGET_SETTINGS_ID = "week-plain";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-calendar--week-plain {
      box-sizing: border-box;
      width: var(--webskin-calendar-width, 28rem);
      height: var(--webskin-calendar-height, 7rem);
      min-width: 0;
      min-height: 0;
    }
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

const applyDateState = (element, date, highlightDate) => {
  const state = calendarDateState(date, true, highlightDate);
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
  const weekday = createPart("weekday");
  const day = createPart("day");
  const month = createPart("month");
  cell.append(weekday, day, month);
  return { cell, parts: { weekday, day, month } };
};

const renderCell = (cell, parts, date, formatters, highlightDate) => {
  applyDateState(cell, date, highlightDate);
  parts.weekday.textContent = localizedWeekday(date.getDay(), formatters, "short");
  parts.weekday.dataset.webskinCalendarToday = cell.dataset.webskinCalendarToday;
  parts.day.textContent = String(date.getDate());
  parts.month.textContent = localizedMonth(date, formatters, "short");
};

class PlainWeek extends Widget {
  constructor(options = {}) {
    rejectLegacyInterval(options);
    ensureStyles();
    const {
      date: suppliedDate,
      locale: suppliedLocale,
      weekStartsOn,
      daysBefore,
      daysAfter,
      highlightDate: suppliedHighlightDate,
      updateInterval,
      widgetId = WIDGET_SETTINGS_ID,
      className = "",
      variant = "plain",
    } = options;
    validateUpdateInterval(updateInterval);

    const locale = resolveLocale(suppliedLocale);
    const formatters = createCalendarFormatters(locale);
    const highlightDate = resolveHighlightDate(suppliedDate, suppliedHighlightDate);
    const firstDay = localeWeekStartsOn(locale, weekStartsOn);
    const rollingWindow = resolveWeekWindow(daysBefore, daysAfter);
    const element = document.createElement("div");
    super(element, { type: "calendar", variant });
    element.className = classNames("webskin-calendar", "webskin-calendar--week-plain", `webskin-calendar--${variant}`, className);

    const grid = createPart("week");
    element.append(grid);
    const cells = Array.from({ length: 7 }, createCell);
    grid.append(...cells.map(({ cell }) => cell));

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
      days.forEach((day, index) => renderCell(cells[index].cell, cells[index].parts, day, formatters, highlightDate));
    };

    render(suppliedDate);
    this.setState("ready");
    if (suppliedDate === undefined) {
      this.addCleanup(watchCurrentDate(render, { updateInterval, widgetId }));
    }
  }
}

export function createWeek(options = {}) {
  return new PlainWeek(options).element;
}
