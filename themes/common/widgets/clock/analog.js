const SVG_NS = "http://www.w3.org/2000/svg";
const STYLE_ID = "webskin-clock-analog-styles";

const svgElement = (tag, attributes = {}) => {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
};

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-clock--analog {
      --webskin-analog-color: currentColor;
      --webskin-analog-face: transparent;
      --webskin-analog-frame: currentColor;
      color: var(--webskin-analog-color);
      display: block;
      overflow: visible;
    }
    .webskin-clock--analog [data-webskin-clock-part="face"] {
      fill: var(--webskin-analog-face);
      stroke: var(--webskin-analog-frame);
      stroke-width: 2;
    }
    .webskin-clock--analog [data-webskin-clock-part="tick"] { stroke: currentColor; stroke-width: 1.5; opacity: .55; }
    .webskin-clock--analog [data-webskin-clock-part="hour-hand"] { stroke: currentColor; stroke-width: 4; stroke-linecap: round; }
    .webskin-clock--analog [data-webskin-clock-part="minute-hand"] { stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; }
    .webskin-clock--analog [data-webskin-clock-part="second-hand"] { stroke: currentColor; stroke-width: 1.2; stroke-linecap: round; }
    .webskin-clock--analog [data-webskin-clock-part="pin"] { fill: currentColor; }
  `;
  document.head.append(style);
};

const clockAngles = (now) => ({
  hour: ((now.getHours() % 12) + now.getMinutes() / 60) * 30,
  minute: (now.getMinutes() + now.getSeconds() / 60) * 6,
  second: now.getSeconds() * 6,
});

/** Create a WebSkin-provided, pre-styled analog clock. */
export function createClock(options = {}) {
  ensureStyles();
  const {
    size = "10rem",
    color,
    faceColor,
    frameColor,
    showSeconds = true,
    className = "",
  } = options;

  const element = svgElement("svg", {
    viewBox: "0 0 100 100",
    role: "img",
    "aria-label": "Analog clock",
  });
  element.classList.add("webskin-clock", "webskin-clock--analog", ...String(className).split(/\s+/).filter(Boolean));
  element.dataset.webskinWidget = "clock";
  element.style.width = size;
  element.style.height = size;
  if (color) element.style.setProperty("--webskin-analog-color", color);
  if (faceColor) element.style.setProperty("--webskin-analog-face", faceColor);
  if (frameColor) element.style.setProperty("--webskin-analog-frame", frameColor);

  const face = svgElement("circle", { cx: "50", cy: "50", r: "44" });
  face.dataset.webskinClockPart = "face";
  element.append(face);

  for (let index = 0; index < 12; index += 1) {
    const angle = index * 30 * Math.PI / 180;
    const tick = svgElement("line", {
      x1: String(50 + Math.sin(angle) * 38),
      y1: String(50 - Math.cos(angle) * 38),
      x2: String(50 + Math.sin(angle) * 42),
      y2: String(50 - Math.cos(angle) * 42),
    });
    tick.dataset.webskinClockPart = "tick";
    element.append(tick);
  }

  const hourHand = svgElement("line", { x1: "50", y1: "50", x2: "50", y2: "27" });
  const minuteHand = svgElement("line", { x1: "50", y1: "50", x2: "50", y2: "16" });
  const secondHand = svgElement("line", { x1: "50", y1: "53", x2: "50", y2: "12" });
  hourHand.dataset.webskinClockPart = "hour-hand";
  minuteHand.dataset.webskinClockPart = "minute-hand";
  secondHand.dataset.webskinClockPart = "second-hand";
  element.append(hourHand, minuteHand, secondHand);

  const pin = svgElement("circle", { cx: "50", cy: "50", r: "2.5" });
  pin.dataset.webskinClockPart = "pin";
  element.append(pin);

  const render = () => {
    const angles = clockAngles(new Date());
    hourHand.setAttribute("transform", `rotate(${angles.hour} 50 50)`);
    minuteHand.setAttribute("transform", `rotate(${angles.minute} 50 50)`);
    secondHand.setAttribute("transform", `rotate(${angles.second} 50 50)`);
    secondHand.hidden = !showSeconds;
  };

  render();
  const timer = window.setInterval(render, 1000);
  Object.defineProperty(element, "destroy", {
    configurable: true,
    value: () => window.clearInterval(timer),
  });
  return element;
}
