export const classNames = (...values) => values
  .flatMap((value) => String(value ?? "").split(/\s+/))
  .filter(Boolean)
  .join(" ");

export const ensureStyle = (id, textContent) => {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return;
  if (document.getElementById?.(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = textContent;
  document.head?.append(style);
};

export const rejectLegacyInterval = (options) => {
  if (options && Object.prototype.hasOwnProperty.call(options, "interval")) {
    throw new TypeError("interval is not supported; use updateInterval in seconds");
  }
};

export const maskedAsset = (root, name) => {
  const image = document.createElement("span");
  const url = `url("${root + name}")`;
  image.style.setProperty("background-color", "currentColor");
  image.style.setProperty("mask-image", url);
  image.style.setProperty("mask-position", "center");
  image.style.setProperty("mask-repeat", "no-repeat");
  image.style.setProperty("mask-size", "contain");
  image.style.setProperty("-webkit-mask-image", url);
  image.style.setProperty("-webkit-mask-position", "center");
  image.style.setProperty("-webkit-mask-repeat", "no-repeat");
  image.style.setProperty("-webkit-mask-size", "contain");
  image.setAttribute("aria-hidden", "true");
  return image;
};
