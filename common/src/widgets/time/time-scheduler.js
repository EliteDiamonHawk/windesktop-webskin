const DEFAULT_CLOCK_UPDATE_INTERVAL = 5;
const DEFAULT_CALENDAR_UPDATE_INTERVAL = 60;

const APP_SETTINGS = {
  clock: {
    key: "time_clock_update_interval_seconds",
    fallback: DEFAULT_CLOCK_UPDATE_INTERVAL,
  },
  calendar: {
    key: "time_calendar_update_interval_seconds",
    fallback: DEFAULT_CALENDAR_UPDATE_INTERVAL,
  },
};

const clockSubscribers = new Set();
const calendarSubscribers = new Set();
const appIntervalPromises = new Map();
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

const getAppInterval = (family) => {
  const setting = APP_SETTINGS[family];
  if (!setting) throw new TypeError("Unknown time scheduler family: " + family);
  if (appIntervalPromises.has(family)) return appIntervalPromises.get(family);

  const promise = (async () => {
    if (typeof window === "undefined" || typeof window.fetch !== "function") return setting.fallback;
    try {
      const response = await window.fetch(`/api/settings/app/${setting.key}`);
      if (!response.ok) return setting.fallback;
      const value = await response.json();
      return isValidInterval(value) ? value : setting.fallback;
    } catch {
      return setting.fallback;
    }
  })();
  appIntervalPromises.set(family, promise);
  return promise;
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

const subscribe = (family, callback, requestedInterval) => {
  const explicitInterval = validateUpdateInterval(requestedInterval);
  const setting = APP_SETTINGS[family];
  const subscribers = family === "clock" ? clockSubscribers : calendarSubscribers;
  const subscriber = {
    callback,
    interval: explicitInterval ?? setting.fallback,
    nextDue: Date.now() + (explicitInterval ?? setting.fallback) * 1000,
    usesAppDefault: explicitInterval === undefined,
  };
  subscribers.add(subscriber);
  schedule(family);

  if (subscriber.usesAppDefault) {
    void getAppInterval(family).then((interval) => {
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

export const subscribeClock = (callback, updateInterval) => subscribe("clock", callback, updateInterval);

export const subscribeCalendar = (callback, updateInterval) => subscribe("calendar", callback, updateInterval);

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
