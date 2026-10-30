const DEFAULT_ENDPOINT = "/api/system/time";
const DEFAULT_INTERVAL = 60;
const POLL_GROUPS = new Map();

const host = () => (typeof window === "undefined" ? globalThis : window);

const validInterval = (value) => Number.isInteger(value) && value > 0;

const requestSystemTime = async (endpoint, signal) => {
  const request = typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : typeof host().fetch === "function" ? host().fetch.bind(host()) : null;
  if (!request) throw new TypeError("Timers require fetch to query system time");
  const response = await request(endpoint, { signal });
  if (!response?.ok) throw new Error(`System time query failed: ${response?.status ?? "unknown status"}`);
  const value = await response.json();
  if (!Number.isFinite(value?.epochMilliseconds)) {
    throw new TypeError("System time response must contain epochMilliseconds");
  }
  return value.epochMilliseconds;
};

class TimerPollGroup {
  constructor(endpoint, interval, key) {
    this.endpoint = endpoint;
    this.interval = interval;
    this.key = key;
    this.subscribers = new Set();
    this.inFlight = false;
    this.pendingStart = false;
    this.controller = null;
    this.timer = null;
  }

  subscribe(subscriber) {
    const firstSubscriber = this.subscribers.size === 0;
    this.subscribers.add(subscriber);
    if (firstSubscriber) this.requestRefresh();
    return () => this.unsubscribe(subscriber);
  }

  requestRefresh() {
    if (this.inFlight || this.pendingStart || !this.subscribers.size) return;
    this.pendingStart = true;
    queueMicrotask(() => {
      this.pendingStart = false;
      if (this.subscribers.size) void this.refresh();
    });
  }

  scheduleNext() {
    if (!this.subscribers.size) return;
    this.timer = host().setTimeout(() => {
      this.timer = null;
      void this.refresh();
    }, this.interval * 1000);
  }

  unsubscribe(subscriber) {
    this.subscribers.delete(subscriber);
    if (this.subscribers.size) return;
    if (this.timer !== null) host().clearTimeout(this.timer);
    this.controller?.abort();
    this.timer = null;
    this.controller = null;
    POLL_GROUPS.delete(this.key);
  }

  async refresh() {
    if (!this.subscribers.size || this.inFlight) return;
    this.inFlight = true;
    this.controller = typeof AbortController === "function" ? new AbortController() : null;
    try {
      const epochMilliseconds = await requestSystemTime(this.endpoint, this.controller?.signal);
      [...this.subscribers].forEach((subscriber) => subscriber.onTime?.(epochMilliseconds));
    } catch (error) {
      if (error?.name !== "AbortError") {
        [...this.subscribers].forEach((subscriber) => subscriber.onError?.(error));
      }
    } finally {
      this.controller = null;
      this.inFlight = false;
      if (this.subscribers.size) this.scheduleNext();
    }
  }
}

export const timerTimeManager = {
  subscribe({ endpoint = DEFAULT_ENDPOINT, interval = DEFAULT_INTERVAL, updateInterval, onTime, onError } = {}) {
    const normalizedInterval = updateInterval ?? interval;
    if (!validInterval(normalizedInterval)) {
      throw new RangeError("updateInterval must be a positive integer number of seconds");
    }
    const key = endpoint + "::" + normalizedInterval;
    let group = POLL_GROUPS.get(key);
    if (!group) {
      group = new TimerPollGroup(endpoint, normalizedInterval, key);
      POLL_GROUPS.set(key, group);
    }
    return group.subscribe({ onTime, onError });
  },
};

export { DEFAULT_ENDPOINT, DEFAULT_INTERVAL };
