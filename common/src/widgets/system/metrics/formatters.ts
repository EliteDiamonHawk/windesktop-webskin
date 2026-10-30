export const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

export const unavailable = (phase = "ready") => phase === "initial" ? "-" : "n/a";

export const formatNumber = (value, phase = "ready", digits = 1) => {
  if (!isNumber(value)) return unavailable(phase);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
};

export const formatInteger = (value, phase = "ready") => formatNumber(value, phase, 0);

export const formatBoolean = (value, phase = "ready") => {
  if (typeof value !== "boolean") return unavailable(phase);
  return String(value);
};

export const formatText = (value, phase = "ready") => {
  if (value === undefined || value === null || value === "") return unavailable(phase);
  return String(value);
};

export const formatBytes = (value, phase = "ready") => {
  if (!isNumber(value)) return { value: unavailable(phase), unit: unavailable(phase) };
  if (value < 1024) return { value: String(value), unit: "B" };
  const units = ["KiB", "MiB", "GiB", "TiB", "PiB"];
  let scaled = value;
  let index = -1;
  while (scaled >= 1024 && index < units.length - 1) {
    scaled /= 1024;
    index += 1;
  }
  return {
    value: new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(scaled),
    unit: units[index],
  };
};

export const findBy = (records, key, value) => (
  Array.isArray(records) ? records.find((record) => record?.[key] === value) : undefined
);
