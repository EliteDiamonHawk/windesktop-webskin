const DEFAULT_CLOCK_UPDATE_INTERVAL = 5;
const DEFAULT_CALENDAR_UPDATE_INTERVAL = 60;

const clockSubscribers = new Set();
const calendarSubscribers = new Set();
let resolvedIntervalsPromise;
let clockTimer;
let calendarTimer;
let animationFrame;
const animationSubscribers = new Set();

const isValidInterval = (value) => Number.isInteger(value) && value > 0;

export const validateUpdateInterval = (value) => {
  if (value === undefined) return undefined;
  if (!isValidInterval(value)) throw new RangeError("updateInterval must be a positive integer number of seconds");
  return value;
};

const resolvedIntervals = async () => {
  if (!resolvedIntervalsPromise) {
    resolvedIntervalsPromise = (async () => {
      const fallback = {
        clock: DEFAULT_CLOCK_UPDATE_INTERVAL,
        calendar: DEFAULT_CALENDAR_UPDATE_INTERVAL,
        widgets: {},
      };
      if (typeof window === "undefined" || typeof window.fetch !== "function") return fallback;
      try {
        const response = await window.fetch("/api/settings/widgets/time-intervals");
        if (!response.ok) return fallback;
        const value = await response.json();
        return {
          clock: isValidInterval(value?.clock) ? value.clock : fallback.clock,
          calendar: isValidInterval(value?.calendar) ? value.calendar : fallback.calendar,
          widgets: Object.fromEntries(
            Object.entries(value?.widgets ?? {})
              .filter(([, interval]) => isValidInterval(interval)),
          ),
        };
      } catch {
        return fallback;
      }
    })();
  }
  return resolvedIntervalsPromise;
};

const schedule = (kind) => {
  const subscribers = kind === "clock" ? clockSubscribers : calendarSubscribers;
  const currentTimer = kind === "clock" ? clockTimer : calendarTimer;
  if (!subscribers.size) {
    if (currentTimer !== undefined) {
      window.clearTimeout(currentTimer);
      if (kind === "clock") clockTimer = undefined;
      else calendarTimer = undefined;
    }
    return;
  }

  const now = Date.now();
  const nextDue = Math.min(...[...subscribers].map((subscriber) => subscriber.nextDue));
  const delay = Math.max(1, nextDue - now);
  const timer = window.setTimeout(() => {
    if (kind === "clock") clockTimer = undefined;
    else calendarTimer = undefined;
    const current = Date.now();
    const snapshot = new Date(current);
    for (const subscriber of [...subscribers]) {
      if (current >= subscriber.nextDue) {
        do {
          subscriber.nextDue += subscriber.interval * 1000;
        } while (subscriber.nextDue <= current);
        subscriber.callback(snapshot);
      }
    }
    schedule(kind);
  }, delay);
  if (currentTimer !== undefined) window.clearTimeout(currentTimer);
  if (kind === "clock") clockTimer = timer;
  else calendarTimer = timer;
};

const normalizeOptions = (value) => {
  if (value === undefined || typeof value === "number") return { updateInterval: value };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Time scheduler options must be an object");
  }
  return value;
};

const subscribe = (family, callback, requestedOptions) => {
  const options = normalizeOptions(requestedOptions);
  const explicitInterval = validateUpdateInterval(options.updateInterval);
  const widgetId = options.widgetId;
  const fallback = family === "clock" ? DEFAULT_CLOCK_UPDATE_INTERVAL : DEFAULT_CALENDAR_UPDATE_INTERVAL;
  const subscribers = family === "clock" ? clockSubscribers : calendarSubscribers;
  const subscriber = {
    callback,
    widgetId,
    interval: explicitInterval ?? fallback,
    nextDue: Date.now() + (explicitInterval ?? fallback) * 1000,
  };
  subscribers.add(subscriber);
  schedule(family);

  if (explicitInterval === undefined) {
    void resolvedIntervals().then((intervals) => {
      const interval = intervals.widgets?.[widgetId] ?? intervals[family];
      if (!subscribers.has(subscriber) || subscriber.interval === interval) return;
      subscriber.interval = interval;
      subscriber.nextDue = Date.now() + interval * 1000;
      schedule(family);
    });
  }

  return () => {
    subscribers.delete(subscriber);
    schedule(family);
  };
};

export const subscribeClock = (callback, options) => subscribe("clock", callback, options);

export const subscribeCalendar = (callback, options) => subscribe("calendar", callback, options);

const animate = () => {
  animationFrame = undefined;
  if (!animationSubscribers.size) return;
  const snapshot = new Date();
  for (const callback of [...animationSubscribers]) callback(snapshot);
  animationFrame = window.requestAnimationFrame(animate);
};

export const subscribeAnimation = (callback) => {
  animationSubscribers.add(callback);
  if (animationFrame === undefined) animationFrame = window.requestAnimationFrame(animate);
  return () => {
    animationSubscribers.delete(callback);
    if (!animationSubscribers.size && animationFrame !== undefined) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
    }
  };
};

export const schedulerDefaults = Object.freeze({
  clock: DEFAULT_CLOCK_UPDATE_INTERVAL,
  calendar: DEFAULT_CALENDAR_UPDATE_INTERVAL,
});
