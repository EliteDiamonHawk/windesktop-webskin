export const isNumber = (value) => typeof value === "number" && Number.isFinite(value);

export const unavailable = (phase = "ready") => phase === "initial" ? "-" : "n/a";

const numericDigits = (value) => (value.match(/\d/g) ?? []).length;

const trimNumeric = (value, limit) => {
  if (numericDigits(value) <= limit) return value;
  const sign = /^[+-]/.test(value) ? value[0] : "";
  const unsigned = value.slice(sign.length).replace(/,/g, "");
  const [integer, fraction = ""] = unsigned.split(".");
  const digits = integer + fraction;
  const kept = digits.slice(0, limit);
  if (integer.length >= limit) return sign + kept;
  const keptFraction = kept.slice(integer.length);
  return sign + kept.slice(0, integer.length) + (keptFraction ? "." + keptFraction : "");
};

export const validateDigitLimit = (digitLimit) => {
  if (digitLimit !== undefined && (!Number.isInteger(digitLimit) || digitLimit <= 0)) {
    throw new RangeError("digitLimit must be a positive integer");
  }
};

const applyDigitLimit = (value, digitLimit) => {
  validateDigitLimit(digitLimit);
  return digitLimit === undefined ? value : trimNumeric(value, digitLimit);
};

export const formatNumber = (value, phase = "ready", digits = 1, digitLimit) => {
  validateDigitLimit(digitLimit);
  if (!isNumber(value)) return unavailable(phase);
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
  return applyDigitLimit(formatted, digitLimit);
};

export const formatInteger = (value, phase = "ready", digitLimit) => formatNumber(value, phase, 0, digitLimit);

export const formatBoolean = (value, phase = "ready") => {
  if (typeof value !== "boolean") return unavailable(phase);
  return String(value);
};

export const formatText = (value, phase = "ready") => {
  if (value === undefined || value === null || value === "") return unavailable(phase);
  return String(value);
};

export const formatBytes = (value, phase = "ready", digitLimit) => {
  validateDigitLimit(digitLimit);
  if (!isNumber(value)) return { value: unavailable(phase), unit: unavailable(phase) };
  if (value < 1024) return { value: applyDigitLimit(String(value), digitLimit), unit: "B" };
  const units = ["KiB", "MiB", "GiB", "TiB", "PiB"];
  let scaled = value;
  let index = -1;
  while (scaled >= 1024 && index < units.length - 1) {
    scaled /= 1024;
    index += 1;
  }
  return {
    value: applyDigitLimit(new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(scaled), digitLimit),
    unit: units[index],
  };
};

export const findBy = (records, key, value) => (
  Array.isArray(records) ? records.find((record) => record?.[key] === value) : undefined
);
