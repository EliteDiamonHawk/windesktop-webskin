const pad = (value) => String(value).padStart(2, "0");

const createPart = (part, text = "") => {
  const element = document.createElement("span");
  element.dataset.webskinClockPart = part;
  element.textContent = text;
  return element;
};

/**
 * Create a theme-owned clock. The returned element deliberately has no
 * Shadow DOM and only exposes semantic parts for ordinary CSS to customize.
 */
export function createClock(options = {}) {
  const {
    format = "12h",
    seconds = true,
    showPeriod = true,
    className = "",
  } = options;

  const element = document.createElement("time");
  element.className = ["webskin-clock", "webskin-clock--plain", className].filter(Boolean).join(" ");
  element.dataset.webskinWidget = "clock";
  element.setAttribute("aria-label", "Current time");

  const hours = createPart("hours");
  const separator = createPart("separator", ":");
  const minutes = createPart("minutes");
  const secondsPart = createPart("seconds");
  const period = createPart("period");
  element.append(hours, separator, minutes, secondsPart, period);

  const render = () => {
    const now = new Date();
    const hourValue = format === "24h" ? now.getHours() : now.getHours() % 12 || 12;
    const periodValue = now.getHours() >= 12 ? "PM" : "AM";
    hours.textContent = format === "24h" ? pad(hourValue) : pad(hourValue);
    minutes.textContent = pad(now.getMinutes());
    secondsPart.textContent = pad(now.getSeconds());
    secondsPart.hidden = !seconds;
    period.textContent = periodValue;
    period.hidden = format === "24h" || !showPeriod;
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
