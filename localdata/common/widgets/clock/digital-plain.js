const pad = (value) => String(value).padStart(2, "0");

const createPart = (part, text = "") => {
  const element = document.createElement("span");
  element.dataset.webskinClockPart = part;
  element.textContent = text;
  return element;
};

const tokenPattern = /HH|hh|mm|ss|H|h|m|s|A|a/g;

const defaultSyntax = ({ format, seconds, showPeriod }) => [
  format === "24h" ? "HH" : "hh",
  ":",
  "mm",
  seconds ? ":ss" : "",
  format === "12h" && showPeriod ? " A" : "",
].join("");

const tokenPart = (token) => {
  if (token === "HH" || token === "H" || token === "hh" || token === "h") return "hours";
  if (token === "mm" || token === "m") return "minutes";
  if (token === "ss" || token === "s") return "seconds";
  if (token === "A" || token === "a") return "period";
  return "separator";
};

const tokenValue = (token, now) => {
  const hour24 = now.getHours();
  const hour12 = hour24 % 12 || 12;
  const values = {
    HH: pad(hour24),
    H: String(hour24),
    hh: pad(hour12),
    h: String(hour12),
    mm: pad(now.getMinutes()),
    m: String(now.getMinutes()),
    ss: pad(now.getSeconds()),
    s: String(now.getSeconds()),
    A: hour24 >= 12 ? "PM" : "AM",
    a: hour24 >= 12 ? "pm" : "am",
  };
  return values[token] ?? token;
};

/** Create a theme-owned digital clock with ordinary DOM hooks. */
export function createClock(options = {}) {
  const {
    format = "12h",
    seconds = true,
    showPeriod = true,
    syntax,
    offsetMinutes = 0,
    className = "",
  } = options;

  const element = document.createElement("time");
  element.className = ["webskin-clock", "webskin-clock--digital-plain", className].filter(Boolean).join(" ");
  element.dataset.webskinWidget = "clock";
  element.setAttribute("aria-label", "Current time");

  const displaySyntax = syntax ?? defaultSyntax({ format, seconds, showPeriod });
  const parts = [];
  let cursor = 0;
  for (const match of displaySyntax.matchAll(tokenPattern)) {
    if (match.index > cursor) {
      parts.push({ token: displaySyntax.slice(cursor, match.index), element: createPart("separator") });
    }
    parts.push({ token: match[0], element: createPart(tokenPart(match[0])) });
    cursor = match.index + match[0].length;
  }
  if (cursor < displaySyntax.length) {
    parts.push({ token: displaySyntax.slice(cursor), element: createPart("separator") });
  }
  element.append(...parts.map(({ element: part }) => part));

  const render = () => {
    const now = new Date(Date.now() + Number(offsetMinutes) * 60_000);
    for (const part of parts) part.element.textContent = tokenValue(part.token, now);
    element.dateTime = now.toISOString();
  };

  render();
  const timer = window.setInterval(render, 1000);
  Object.defineProperty(element, "destroy", {
    configurable: true,
    value: () => window.clearInterval(timer),
  });
  return element;
}
