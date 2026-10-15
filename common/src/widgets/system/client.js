import { Widget } from "../widgets.js";

export const DEFAULT_INTERVAL = 5000;
export const DEFAULT_INTERVALS = Object.freeze({ fast: 5000, standard: 30000, slow: 60000 });
const TOKEN_PATTERN = /\{([a-z][a-z0-9-]*)\}/g;
const LEGACY_TOKEN_PATTERN = /\<[^<>]*\>/;
const ESCAPES = { n: "\n", r: "\r", t: "\t", "\\": "\\" };
const POLL_GROUPS = new Map();
let resolvedIntervalsPromise;

const settingsFallback = () => ({
  fast: DEFAULT_INTERVALS.fast,
  standard: DEFAULT_INTERVALS.standard,
  slow: DEFAULT_INTERVALS.slow,
  widgets: {},
});

const validSeconds = (value) => Number.isInteger(value) && value > 0;

const settingsFetch = () => {
  if (typeof window !== "undefined" && typeof window.fetch === "function") return window.fetch.bind(window);
  if (typeof fetch === "function") return fetch;
  return null;
};

const resolvedIntervals = async () => {
  if (!resolvedIntervalsPromise) {
    resolvedIntervalsPromise = (async () => {
      const fallback = settingsFallback();
      const request = settingsFetch();
      if (!request) return fallback;
      try {
        const response = await request("/api/settings/widgets/system-intervals");
        if (!response.ok) return fallback;
        const value = await response.json();
        const familyInterval = (family) => (
          validSeconds(value?.[family]) ? value[family] * 1000 : fallback[family]
        );
        return {
          fast: familyInterval("fast"),
          standard: familyInterval("standard"),
          slow: familyInterval("slow"),
          widgets: Object.fromEntries(
            Object.entries(value?.widgets ?? {})
              .filter(([, interval]) => validSeconds(interval))
              .map(([widgetId, interval]) => [widgetId, interval * 1000]),
          ),
        };
      } catch {
        return fallback;
      }
    })();
  }
  return resolvedIntervalsPromise;
};

export const createPart = (part, text = "n/a", tag = "span") => {
  const element = document.createElement(tag);
  element.dataset.webskinSystemPart = part;
  element.textContent = text;
  return element;
};

export const decodeFormat = (format) => format.replace(/\\([nrt\\])/g, (match, value) => ESCAPES[value] ?? match);

export const resolveFormat = (format, defaultFormat, tokens, family) => {
  const resolved = format === undefined ? defaultFormat : format;
  if (typeof resolved !== "string") throw new TypeError(family + " format must be a string");
  if (LEGACY_TOKEN_PATTERN.test(resolved)) {
    throw new TypeError(family + " format must use brace tokens");
  }
  const decoded = decodeFormat(resolved);
  const supported = new Set(tokens);
  for (const match of decoded.matchAll(TOKEN_PATTERN)) {
    if (!supported.has(match[1])) {
      throw new TypeError("Unsupported " + family + " format token: {" + match[1] + "}");
    }
  }
  return decoded;
};

export const fieldsForFormat = (format, tokenFields) => {
  const fields = new Set();
  for (const match of format.matchAll(TOKEN_PATTERN)) {
    const field = tokenFields[match[1]];
    if (Array.isArray(field)) field.forEach((item) => fields.add(item));
    else if (field) fields.add(field);
  }
  return [...fields];
};

const displayValue = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  return String(value);
};

export const renderTokenLine = (row, line, values, fallback = "n/a", partPrefix = "") => {
  let cursor = 0;
  for (const match of line.matchAll(TOKEN_PATTERN)) {
    if (match.index > cursor) row.append(document.createTextNode(line.slice(cursor, match.index)));
    const token = match[1];
    const element = createPart(partPrefix + token, displayValue(values[token], fallback));
    element.dataset.webskinSystemFormatPart = token;
    row.append(element);
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) row.append(document.createTextNode(line.slice(cursor)));
};

export const renderTokenFormat = (root, format, values, {
  fallback = "n/a",
  partPrefix = "",
  rowParts = [],
} = {}) => {
  root.replaceChildren();
  format.split(/\r\n|\n|\r/).forEach((line, index) => {
    const row = document.createElement("div");
    row.dataset.webskinSystemPart = rowParts[index] ?? partPrefix + "row-" + index;
    renderTokenLine(row, line, values, fallback, partPrefix);
    root.append(row);
  });
};

export const renderRepeatedFormat = (root, format, rows, {
  fallback = "n/a",
  partPrefix = "",
} = {}) => {
  root.replaceChildren();
  rows.forEach((values, index) => {
    const row = document.createElement("div");
    row.dataset.webskinSystemPart = partPrefix + "row-" + index;
    renderTokenLine(row, format, values, fallback, partPrefix + index + "-");
    root.append(row);
  });
};

const endpointWithFields = (endpoint, fields) => {
  const separator = endpoint.includes("?") ? "&" : "?";
  return endpoint + separator + "fields=" + encodeURIComponent(fields.join(","));
};

const intervalValue = (interval) => {
  const value = Number(interval);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_INTERVAL;
};

const updateIntervalValue = (updateInterval) => {
  if (updateInterval === undefined) return undefined;
  if (!validSeconds(updateInterval)) {
    throw new RangeError("updateInterval must be a positive integer number of seconds");
  }
  return updateInterval * 1000;
};

const numberValue = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;

const transferSnapshot = (snapshot, previous) => {
  const network = snapshot?.network ?? {};
  const sent = numberValue(network.bytes_sent);
  const received = numberValue(network.bytes_received);
  const now = Date.now();
  const elapsed = previous ? (now - previous.at) / 1000 : 0;
  const rate = (current, prior) => (
    current !== null && prior !== null && elapsed > 0 && current >= prior
      ? (current - prior) / elapsed
      : null
  );
  const transfer = {
    uploaded: sent,
    downloaded: received,
    upload_speed: rate(sent, previous?.sent ?? null),
    download_speed: rate(received, previous?.received ?? null),
    utilization: null,
  };
  const next = {
    ...snapshot,
    network: { ...network, transfer },
  };
  const nextPrevious = sent !== null || received !== null ? { sent, received, at: now } : previous;
  return { snapshot: next, previous: nextPrevious };
};

class MetricsPollGroup {
  constructor(endpoint, interval, key) {
    this.endpoint = endpoint;
    this.interval = interval;
    this.key = key;
    this.subscribers = new Set();
    this.inFlight = false;
    this.needsRefresh = false;
    this.pendingStart = false;
    this.controller = null;
    this.timer = null;
    this.previousNetwork = null;
  }

  fields() {
    return [...new Set([...this.subscribers].flatMap((subscriber) => subscriber.fields))].sort();
  }

  subscribe(subscriber, start = true) {
    this.subscribers.add(subscriber);
    if (start) this.requestRefresh();
    return () => this.unsubscribe(subscriber);
  }

  requestRefresh() {
    if (this.inFlight) {
      this.needsRefresh = true;
      return;
    }
    if (this.pendingStart || !this.subscribers.size) return;
    this.pendingStart = true;
    queueMicrotask(() => {
      this.pendingStart = false;
      if (this.subscribers.size) void this.refresh();
    });
  }

  scheduleNext() {
    if (!this.subscribers.size) return;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.refresh();
    }, this.interval);
  }

  unsubscribe(subscriber) {
    this.subscribers.delete(subscriber);
    if (this.subscribers.size) return;
    if (this.timer !== null) window.clearTimeout(this.timer);
    if (this.controller) this.controller.abort();
    this.timer = null;
    this.controller = null;
    POLL_GROUPS.delete(this.key);
  }

  notifyError(error) {
    [...this.subscribers].forEach((subscriber) => subscriber.onError?.(error));
  }

  async refresh() {
    if (!this.subscribers.size) return;
    if (this.inFlight) {
      this.needsRefresh = true;
      return;
    }
    this.inFlight = true;
    this.needsRefresh = false;
    const fields = this.fields();
    const requestFields = fields.join(",");
    this.controller = new AbortController();
    try {
      const response = await fetch(endpointWithFields(this.endpoint, fields), { signal: this.controller.signal });
      if (!response.ok) throw new Error("System metrics request failed: " + response.status);
      const rawSnapshot = await response.json();
      const transferred = transferSnapshot(rawSnapshot, this.previousNetwork);
      this.previousNetwork = transferred.previous;
      [...this.subscribers].forEach((subscriber) => subscriber.onSnapshot(transferred.snapshot));
      if (requestFields !== this.fields().join(",")) this.needsRefresh = true;
    } catch (error) {
      if (error?.name !== "AbortError") this.notifyError(error);
    } finally {
      this.controller = null;
      this.inFlight = false;
      if (this.subscribers.size) this.scheduleNext();
    }
  }
}

export const systemMetricsManager = {
  subscribe({ endpoint = "/api/system/metrics", interval, updateInterval, widgetId, family = "fast", fields = [], onSnapshot, onError }) {
    const explicitInterval = interval !== undefined
      ? intervalValue(interval)
      : updateIntervalValue(updateInterval);
    const fallbackInterval = DEFAULT_INTERVALS[family] ?? DEFAULT_INTERVAL;
    const state = {
      active: true,
      interval: explicitInterval ?? fallbackInterval,
      group: null,
      unsubscribe: null,
    };
    const subscriber = {
      fields: [...new Set(fields)].sort(),
      onSnapshot,
      onError,
    };
    const join = (normalizedInterval, start = true) => {
      const key = endpoint + "::" + normalizedInterval;
      let group = POLL_GROUPS.get(key);
      if (!group) {
        group = new MetricsPollGroup(endpoint, normalizedInterval, key);
        POLL_GROUPS.set(key, group);
      }
      state.interval = normalizedInterval;
      state.group = group;
      state.unsubscribe = group.subscribe(subscriber, start);
    };
    join(state.interval, explicitInterval !== undefined);

    if (explicitInterval === undefined) {
      void resolvedIntervals().then((intervals) => {
        if (!state.active) return;
        const configured = intervals.widgets?.[widgetId] ?? intervals[family] ?? fallbackInterval;
        if (configured !== state.interval) {
          state.unsubscribe?.();
          join(configured);
        } else {
          state.group?.requestRefresh();
        }
      });
    }

    return () => {
      if (!state.active) return;
      state.active = false;
      state.unsubscribe?.();
    };
  },
};

const SYSTEM_WIDGET_CONFIG = Object.freeze({
  "battery": { widgetId: "battery-plain", family: "standard" },
  "cpu-utilization": { widgetId: "cpu-utilization-plain", family: "fast" },
  "cpu-utilization-list": { widgetId: "cpu-utilization-list-plain", family: "fast" },
  "cpu-core-counts": { widgetId: "cpu-core-counts-plain", family: "slow" },
  "cpu-frequency": { widgetId: "cpu-frequency-plain", family: "standard" },
  "cpu-telemetry": { widgetId: "cpu-telemetry-plain", family: "standard" },
  "cpu-load-average": { widgetId: "cpu-load-average-plain", family: "standard" },
  "memory": { widgetId: "memory-plain", family: "standard" },
  "swap-memory": { widgetId: "swap-memory-plain", family: "standard" },
  "disk-io": { widgetId: "disk-io-plain", family: "fast" },
  "network-telemetry": { widgetId: "network-telemetry-plain", family: "fast" },
  "disk-partitions": { widgetId: "disk-partitions-plain", family: "slow" },
  "gpu-thermal-fan": { widgetId: "gpu-thermal-fan-plain", family: "fast" },
  "network-telemetry-transfer": { widgetId: "network-telemetry-transfer-plain", family: "fast" },
});

export function createSystemWidget({
  type,
  className = "",
  endpoint = "/api/system/metrics",
  interval,
  updateInterval,
  widgetId,
  family,
  fields = [],
  build,
  render,
} = {}) {
  if (typeof build !== "function" || typeof render !== "function") {
    throw new TypeError("System widgets require build and render functions");
  }

  const element = document.createElement("section");
  const defaults = SYSTEM_WIDGET_CONFIG[type] ?? {};
  const resolvedWidgetId = widgetId ?? defaults.widgetId ?? (typeof type === "string" ? type + "-plain" : undefined);
  const resolvedFamily = family ?? defaults.family ?? "fast";
  const explicitInterval = interval !== undefined ? interval : updateIntervalValue(updateInterval);
  const widget = new Widget(element, { type: "system" });
  element.className = ["webskin-system-widget", "webskin-system-widget--" + type, className]
    .filter(Boolean)
    .join(" ");
  element.dataset.webskinSystemType = type;
  element.setAttribute("aria-live", "polite");
  build(element);
  element.append(createPart("status", "", "output"));
  render(element, null, { phase: "initial" });

  let hasSnapshot = false;
  const unsubscribe = systemMetricsManager.subscribe({
    endpoint,
    interval: explicitInterval,
    widgetId: resolvedWidgetId,
    family: resolvedFamily,
    fields,
    onSnapshot: (snapshot) => {
      hasSnapshot = true;
      element.dataset.webskinSystemState = "ready";
      render(element, snapshot, { phase: "ready" });
    },
    onError: (error) => {
      element.dataset.webskinSystemState = "error";
      if (!hasSnapshot) render(element, null, { phase: "error", error });
    },
  });
  widget.addCleanup(unsubscribe);
  return element;
}
