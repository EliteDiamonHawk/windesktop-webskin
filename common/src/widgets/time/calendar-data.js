// Shared local calendar data for the time widget category.
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DATE_TOKEN_PATTERN = /YYYY|MMMM|dddd|MMM|ddd|YY|MM|DD|M|D/g;

const pad = (value, length = 2) => String(value).padStart(length, "0");

/** Create a local calendar date at noon, avoiding midnight DST transitions. */
export const createLocalDate = (year, monthIndex, day) => {
  const date = new Date(2000, 0, 1, 12);
  date.setFullYear(year, monthIndex, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== monthIndex
    || date.getDate() !== day
  ) {
    throw new RangeError("Invalid calendar date");
  }
  return date;
};

export const today = () => {
  const now = new Date();
  return createLocalDate(now.getFullYear(), now.getMonth(), now.getDate());
};

/** Normalize Date objects and local YYYY-MM-DD values without UTC conversion. */
export const normalizeDate = (value) => {
  if (value === undefined) return today();

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new RangeError("Invalid calendar date");
    return createLocalDate(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new TypeError("Calendar dates must be Date objects or YYYY-MM-DD strings");
    return createLocalDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  throw new TypeError("Calendar dates must be Date objects or YYYY-MM-DD strings");
};

export const dateKey = (date) => `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const sameDate = (left, right) => (
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()
);

export const addDays = (date, amount) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  result.setHours(12, 0, 0, 0);
  return result;
};

export const daysInMonth = (year, monthIndex) => {
  const date = new Date(2000, 0, 1, 12);
  date.setFullYear(year, monthIndex + 1, 0);
  return date.getDate();
};

export const resolveLocale = (locale) => locale ?? new Intl.DateTimeFormat().resolvedOptions().locale;

export const createCalendarFormatters = (locale) => ({
  weekdayLong: new Intl.DateTimeFormat(locale, { weekday: "long" }),
  weekdayShort: new Intl.DateTimeFormat(locale, { weekday: "short" }),
  monthLong: new Intl.DateTimeFormat(locale, { month: "long" }),
  monthShort: new Intl.DateTimeFormat(locale, { month: "short" }),
  medium: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
});

const weekdayDate = (weekdayIndex) => createLocalDate(2023, 0, 1 + weekdayIndex);

export const localizedWeekday = (weekdayIndex, formatters, style = "long") => (
  (style === "short" ? formatters.weekdayShort : formatters.weekdayLong).format(weekdayDate(weekdayIndex))
);

export const localizedMonth = (date, formatters, style = "long") => (
  (style === "short" ? formatters.monthShort : formatters.monthLong).format(date)
);

export const localeWeekStartsOn = (locale, override) => {
  if (override !== undefined) {
    if (!Number.isInteger(override) || override < 0 || override > 6) {
      throw new RangeError("weekStartsOn must be an integer from 0 through 6");
    }
    return override;
  }

  try {
    const localeObject = new Intl.Locale(locale);
    const weekInfo = localeObject.weekInfo ?? localeObject.getWeekInfo?.();
    if (weekInfo?.firstDay >= 1 && weekInfo.firstDay <= 7) return weekInfo.firstDay % 7;
  } catch {
    // Use the broadly supported Sunday default when locale week data is unavailable.
  }
  return 0;
};

export const weekdayOrder = (weekStartsOn) => Array.from(
  { length: 7 },
  (_, index) => (weekStartsOn + index) % 7,
);

export const startOfWeek = (date, weekStartsOn) => addDays(
  date,
  -((date.getDay() - weekStartsOn + 7) % 7),
);

export const getWeekDays = (date, weekStartsOn) => {
  const start = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
};

export const resolveMonthMaxWeeks = (maxWeeks) => {
  if (maxWeeks === undefined) return 6;
  if (!Number.isInteger(maxWeeks) || maxWeeks < 1 || maxWeeks > 6) {
    throw new RangeError("maxWeeks must be an integer from 1 through 6");
  }
  return maxWeeks;
};

export const getMonthGrid = (date, weekStartsOn, maxWeeks = 6) => {
  const monthStart = createLocalDate(date.getFullYear(), date.getMonth(), 1);
  const monthEnd = createLocalDate(date.getFullYear(), date.getMonth(), daysInMonth(date.getFullYear(), date.getMonth()));
  const gridStart = startOfWeek(monthStart, weekStartsOn);
  const leadingDays = (monthStart.getDay() - weekStartsOn + 7) % 7;
  const naturalWeeks = Math.ceil((monthEnd.getDate() + leadingDays) / 7);
  const visibleWeeks = Math.min(naturalWeeks, maxWeeks);
  const anchorWeek = Math.floor((leadingDays + date.getDate() - 1) / 7);
  const firstWeek = naturalWeeks > visibleWeeks && anchorWeek >= visibleWeeks - 1
    ? Math.min(naturalWeeks - visibleWeeks, anchorWeek)
    : 0;
  const visibleStart = addDays(gridStart, firstWeek * 7);

  return Array.from({ length: visibleWeeks * 7 }, (_, index) => {
    const cellDate = addDays(visibleStart, index);
    return {
      date: cellDate,
      inMonth: cellDate.getFullYear() === date.getFullYear() && cellDate.getMonth() === date.getMonth(),
    };
  });
};

export const resolveWeekWindow = (daysBefore, daysAfter) => {
  if (daysBefore === undefined && daysAfter === undefined) return null;

  const validate = (value, name) => {
    if (!Number.isInteger(value) || value < 0 || value > 6) {
      throw new RangeError(`${name} must be an integer from 0 through 6`);
    }
  };

  if (daysBefore === undefined) {
    validate(daysAfter, "daysAfter");
    daysBefore = 6 - daysAfter;
  } else if (daysAfter === undefined) {
    validate(daysBefore, "daysBefore");
    daysAfter = 6 - daysBefore;
  } else {
    validate(daysBefore, "daysBefore");
    validate(daysAfter, "daysAfter");
  }

  if (daysBefore + daysAfter !== 6) {
    throw new RangeError("daysBefore and daysAfter must total 6");
  }
  return { daysBefore, daysAfter };
};

export const getRollingWeekDays = (date, daysBefore) => {
  const start = addDays(date, -daysBefore);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
};

export const resolveMonthLock = (lockDay, maxWeeks = 6) => {
  if (lockDay === undefined) return null;
  if (!lockDay || typeof lockDay !== "object" || Array.isArray(lockDay)) {
    throw new TypeError("lockDay must be an object with y, and optionally x");
  }

  const validate = (value, name, maximum) => {
    if (!Number.isInteger(value) || value < 0 || value > maximum) {
      throw new RangeError(`${name} must be an integer from 0 through ${maximum}`);
    }
  };

  if (lockDay.y === undefined) {
    throw new TypeError("lockDay.y is required");
  }
  validate(lockDay.y, "lockDay.y", maxWeeks - 1);
  if (lockDay.x !== undefined) validate(lockDay.x, "lockDay.x", 6);
  return { x: lockDay.x, y: lockDay.y };
};

export const getRollingMonthGrid = (date, weekStartsOn, lockDay, maxWeeks = 6) => {
  const column = (date.getDay() - weekStartsOn + 7) % 7;
  const start = addDays(date, -(lockDay.y * 7 + (lockDay.x ?? column)));
  const month = date.getMonth();
  const year = date.getFullYear();
  return {
    start,
    cells: Array.from({ length: maxWeeks * 7 }, (_, index) => {
      const cellDate = addDays(start, index);
      return {
        date: cellDate,
        inMonth: cellDate.getFullYear() === year && cellDate.getMonth() === month,
      };
    }),
  };
};

export const calendarDateState = (date, inMonth = true) => ({
  date: dateKey(date),
  weekday: DAY_NAMES[date.getDay()],
  weekdayIndex: date.getDay(),
  today: sameDate(date, today()),
  inMonth,
});

export const parseDateFormat = (format) => {
  if (typeof format !== "string") throw new TypeError("Date format must be a string");

  const segments = [];
  let cursor = 0;
  for (const match of format.matchAll(DATE_TOKEN_PATTERN)) {
    if (match.index > cursor) segments.push({ type: "separator", value: format.slice(cursor, match.index) });
    segments.push({ type: "token", value: match[0] });
    cursor = match.index + match[0].length;
  }
  if (cursor < format.length) segments.push({ type: "separator", value: format.slice(cursor) });
  return segments;
};

export const tokenPart = (token) => {
  if (token === "YYYY" || token === "YY") return "year";
  if (token === "MMMM" || token === "MMM" || token === "MM" || token === "M") return "month";
  if (token === "dddd" || token === "ddd") return "weekday";
  if (token === "DD" || token === "D") return "day";
  return "separator";
};

export const tokenValue = (token, date, formatters) => {
  const values = {
    YYYY: String(date.getFullYear()).padStart(4, "0"),
    YY: pad(date.getFullYear() % 100),
    MMMM: localizedMonth(date, formatters, "long"),
    MMM: localizedMonth(date, formatters, "short"),
    MM: pad(date.getMonth() + 1),
    M: String(date.getMonth() + 1),
    DD: pad(date.getDate()),
    D: String(date.getDate()),
    dddd: localizedWeekday(date.getDay(), formatters, "long"),
    ddd: localizedWeekday(date.getDay(), formatters, "short"),
  };
  return values[token] ?? token;
};

export const mediumDateSegments = (date, formatters) => formatters.medium.formatToParts(date).map(({ type, value }, index) => ({
  type: ["weekday", "month", "day", "year"].includes(type) ? "part" : "separator",
  part: ["weekday", "month", "day", "year"].includes(type) ? type : "separator",
  value,
  index,
}));

/** Notify a current-following widget when the local calendar date changes. */
export const watchCurrentDate = (callback) => {
  let currentKey = dateKey(today());
  const timer = window.setInterval(() => {
    const current = today();
    const nextKey = dateKey(current);
    if (nextKey === currentKey) return;
    currentKey = nextKey;
    callback(current);
  }, 60_000);
  return () => window.clearInterval(timer);
};
