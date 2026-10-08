import { Widget } from "../widgets.js";

export const DEFAULT_INTERVAL = 5000;
export const DEFAULT_FORMAT = "{label} {value} {unit}";

export const createPart = (part, text = "—", tag = "span") => {
  const element = document.createElement(tag);
  element.dataset.webskinSystemPart = part;
  element.textContent = text;
  return element;
};

export const createRow = (part, label, options = {}) => {
  return createFormattedRow(part, label, options);
};

const formatTemplate = (format, unit) => {
  const template = format ?? DEFAULT_FORMAT;
  if (typeof template !== "string") throw new TypeError("System widget format must be a string");
  return unit ? template : template.replace(/\s*\{unit\}/g, "");
};

const createFormattedPart = (part, text, formatPart) => {
  const element = createPart(part, text);
  element.dataset.webskinSystemFormatPart = formatPart;
  return element;
};

const renderFormattedRow = (row, part, label, value, unit, format) => {
  row.replaceChildren();
  const template = formatTemplate(format, unit);
  let cursor = 0;
  for (const match of template.matchAll(/\{(label|value|unit)\}/g)) {
    if (match.index > cursor) row.append(document.createTextNode(template.slice(cursor, match.index)));
    const token = match[1];
    const tokenPart = token === "label" ? `${part}-label` : token === "unit" ? `${part}-unit` : part;
    row.append(createFormattedPart(tokenPart, token === "label" ? label : token === "unit" ? unit : value, token));
    cursor = match.index + match[0].length;
  }
  if (cursor < template.length) row.append(document.createTextNode(template.slice(cursor)));
};

export const createFormattedRow = (part, label, { format = DEFAULT_FORMAT, value = "—", unit = "" } = {}) => {
  const row = document.createElement("div");
  row.dataset.webskinSystemPart = `${part}-row`;
  row.webskinSystemFormat = { part, label, format };
  renderFormattedRow(row, part, label, value, unit, format);
  return row;
};

export const readPath = (value, path) => String(path).split(".").reduce((current, key) => current?.[key], value);

export const isAvailable = (value) => value !== null && value !== undefined;

export const formatNumber = (value, unit = "", digits = 1) => {
  if (!isAvailable(value) || typeof value !== "number" || Number.isNaN(value)) return { value: "Unavailable", unit: "" };
  return { value: new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value), unit };
};

export const formatBytes = (value) => {
  if (!isAvailable(value) || typeof value !== "number" || Number.isNaN(value)) return { value: "Unavailable", unit: "" };
  if (value < 1024) return { value: String(value), unit: "B" };
  const units = ["KiB", "MiB", "GiB", "TiB", "PiB"];
  let scaled = value;
  let index = -1;
  while (scaled >= 1024 && index < units.length - 1) {
    scaled /= 1024;
    index += 1;
  }
  return { value: new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(scaled), unit: units[index] };
};

export const formatText = (value, unit = "") => ({
  value: isAvailable(value) ? String(value) : "Unavailable",
  unit,
});

export const requireNonNegativeInteger = (options, name) => {
  const value = options?.[name];
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`System widget option ${name} must be a non-negative integer`);
  }
  return value;
};

export const requireNonEmptyString = (options, name) => {
  const value = options?.[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`System widget option ${name} must be a non-empty string`);
  }
  return value;
};

export const findRecord = (records, key, value) => (
  Array.isArray(records) ? records.find((record) => record?.[key] === value) : undefined
);

export const parseVariantOptions = (variantOrOptions, options, defaultVariant) => {
  if (variantOrOptions && typeof variantOrOptions === "object" && !Array.isArray(variantOrOptions)) {
    return { variant: defaultVariant, options: variantOrOptions };
  }
  return { variant: variantOrOptions ?? defaultVariant, options: options ?? {} };
};

export const createVariantSystemWidget = ({
  variantOrOptions,
  options,
  defaultVariant,
  family,
  variants,
}) => {
  const parsed = parseVariantOptions(variantOrOptions, options, defaultVariant);
  const variantFactory = variants[parsed.variant];
  if (!variantFactory) {
    throw new TypeError(`Unsupported ${family} variant: ${String(parsed.variant)}`);
  }
  const definition = typeof variantFactory === "function" ? variantFactory(parsed.options) : variantFactory;
  return createScalarSystemWidget({
    options: parsed.options,
    type: `${family}-${parsed.variant}`,
    ...definition,
  });
};

export const createScalarSystemWidget = ({
  options = {},
  type,
  part = "value",
  label,
  read,
}) => {
  const { format } = options;
  return createSystemWidget({
    ...options,
    type,
    build: (root) => root.append(createRow(part, label, { format })),
    render: (root, snapshot) => setMetricText(root, part, read(snapshot)),
  });
};

export const setPartText = (root, part, text) => {
  const selectorPart = String(part).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const elements = [...root.querySelectorAll(`[data-webskin-system-part="${selectorPart}"]`)];
  elements.forEach((element) => { element.textContent = text; });
  return elements[0];
};

export const setMetricText = (root, part, metric) => {
  const selectorPart = String(part).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const rowSelector = `[data-webskin-system-part="${selectorPart}-row"]`;
  const rows = [
    ...(root.matches?.(rowSelector) ? [root] : []),
    ...root.querySelectorAll(rowSelector),
  ];
  if (!rows.length) {
    setPartText(root, part, metric?.value ?? "Unavailable");
    setPartText(root, `${part}-unit`, metric?.unit ?? "");
    return;
  }
  rows.forEach((row) => {
    const settings = row.webskinSystemFormat;
    renderFormattedRow(row, settings.part, settings.label, metric?.value ?? "Unavailable", metric?.unit ?? "", settings.format);
  });
};

export const setStatus = (root, state, message) => {
  root.dataset.webskinSystemState = state;
  const status = root.querySelector('[data-webskin-system-part="status"]');
  if (status) status.textContent = message;
};

export function createSystemWidget({
  type,
  className = "",
  endpoint = "/api/system/metrics",
  interval = DEFAULT_INTERVAL,
  build,
  render,
} = {}) {
  if (typeof build !== "function" || typeof render !== "function") {
    throw new TypeError("System widgets require build and render functions");
  }

  const element = document.createElement("section");
  const widget = new Widget(element, { type: "system" });
  element.className = [
    "webskin-system-widget",
    `webskin-system-widget--${type}`,
    className,
  ].filter(Boolean).join(" ");
  element.dataset.webskinSystemType = type;
  element.setAttribute("aria-live", "polite");
  build(element);
  const status = createPart("status", "Loading…", "output");
  status.setAttribute("aria-live", "polite");
  element.append(status);

  let inFlight = false;
  let hasLoaded = false;
  let destroyed = false;
  const controller = new AbortController();
  const refresh = async () => {
    if (destroyed || inFlight) return;
    inFlight = true;
    if (!hasLoaded) setStatus(element, "loading", "Loading…");
    try {
      const response = await fetch(endpoint, { signal: controller.signal });
      if (!response.ok) throw new Error(`System metrics request failed: ${response.status}`);
      const snapshot = await response.json();
      if (destroyed) return;
      render(element, snapshot);
      hasLoaded = true;
      setStatus(element, "ready", "");
    } catch (error) {
      if (error?.name !== "AbortError") setStatus(element, "error", "System metrics unavailable");
    } finally {
      inFlight = false;
    }
  };

  refresh();
  const delay = Number(interval);
  const timer = window.setInterval(refresh, Number.isFinite(delay) && delay > 0 ? delay : DEFAULT_INTERVAL);
  widget.addCleanup(() => {
    destroyed = true;
    controller.abort();
  });
  widget.addCleanup(() => window.clearInterval(timer));
  return element;
}

