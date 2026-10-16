export const requireOptionsObject = (options, family) => {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError(family + " requires an options object");
  }
  return options;
};

export const requireInteger = (options, name) => {
  const value = options?.[name];
  if (!Number.isInteger(value)) {
    throw new TypeError("System widget option " + name + " must be an integer");
  }
  return value;
};

export const requireNonNegativeInteger = (options, name) => {
  const value = requireInteger(options, name);
  if (value < 0) {
    throw new TypeError("System widget option " + name + " must be a non-negative integer");
  }
  return value;
};

export const requireNonEmptyString = (options, name) => {
  const value = options?.[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("System widget option " + name + " must be a non-empty string");
  }
  return value;
};

export const optionalInteger = (options, name, fallback) => {
  if (options?.[name] === undefined) return fallback;
  return requireInteger(options, name);
};

export const firstMatching = (records, predicate) => (
  Array.isArray(records) ? records.find(predicate) : undefined
);
