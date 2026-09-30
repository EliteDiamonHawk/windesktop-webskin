const SVG_NS = "http://www.w3.org/2000/svg";
const STYLE_ID = "webskin-clock-analog-plain-styles";

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
    .webskin-clock--analog-plain {
      --webskin-analog-frame: #000;
      --webskin-analog-frame-opacity: 1;
      --webskin-analog-face: transparent;
      --webskin-analog-face-opacity: 1;
      --webskin-analog-ticks: #666;
      --webskin-analog-ticks-opacity: .55;
      --webskin-analog-hands: #000;
      --webskin-analog-hands-opacity: 1;
      --webskin-analog-hour-hand: var(--webskin-analog-hands);
      --webskin-analog-hour-hand-opacity: var(--webskin-analog-hands-opacity);
      --webskin-analog-minute-hand: var(--webskin-analog-hands);
      --webskin-analog-minute-hand-opacity: var(--webskin-analog-hands-opacity);
      --webskin-analog-second-hand: var(--webskin-analog-hands);
      --webskin-analog-second-hand-opacity: var(--webskin-analog-hands-opacity);
      color: #000;
      display: block;
      overflow: visible;
    }
    .webskin-clock--analog-plain [data-webskin-clock-part="face"] {
      fill: var(--webskin-analog-face);
      fill-opacity: var(--webskin-analog-face-opacity);
      stroke: var(--webskin-analog-frame);
      stroke-opacity: var(--webskin-analog-frame-opacity);
      stroke-width: 2;
    }
    .webskin-clock--analog-plain [data-webskin-clock-part="tick"] {
      stroke: var(--webskin-analog-ticks);
      stroke-opacity: var(--webskin-analog-ticks-opacity);
      stroke-width: 1.5;
    }
    .webskin-clock--analog-plain [data-webskin-clock-part="hour-hand"] {
      stroke: var(--webskin-analog-hour-hand);
      stroke-opacity: var(--webskin-analog-hour-hand-opacity);
      stroke-linecap: round;
      stroke-width: 4;
    }
    .webskin-clock--analog-plain [data-webskin-clock-part="minute-hand"] {
      stroke: var(--webskin-analog-minute-hand);
      stroke-opacity: var(--webskin-analog-minute-hand-opacity);
      stroke-linecap: round;
      stroke-width: 2.5;
    }
    .webskin-clock--analog-plain [data-webskin-clock-part="second-hand"] {
      stroke: var(--webskin-analog-second-hand);
      stroke-opacity: var(--webskin-analog-second-hand-opacity);
      stroke-linecap: round;
      stroke-width: 1.2;
    }
    .webskin-clock--analog-plain [data-webskin-clock-part="pin"] {
      fill: var(--webskin-analog-hands);
      fill-opacity: var(--webskin-analog-hands-opacity);
    }
  `;
  document.head.append(style);
};

const clockAngles = (now) => ({
  hour: ((now.getHours() % 12) + now.getMinutes() / 60) * 30,
  minute: (now.getMinutes() + now.getSeconds() / 60) * 6,
  second: now.getSeconds() * 6,
});

/** Create a behavior-first analog clock with theme-overridable CSS hooks. */
export function createClock(options = {}) {
  ensureStyles();
  const {
    size = "10rem",
    color,
    frameColor,
    frameOpacity,
    faceColor,
    faceOpacity,
    handsColor,
    handsOpacity,
    hourHandColor,
    hourHandOpacity,
    minuteHandColor,
    minuteHandOpacity,
    secondHandColor,
    secondHandOpacity,
    showHourHand = true,
    showMinuteHand = true,
    showSecondHand = true,
    showTicks = true,
    showSeconds = true,
    offsetMinutes = 0,
    className = "",
  } = options;

  const element = svgElement("svg", {
    viewBox: "0 0 100 100",
    role: "img",
    "aria-label": "Analog clock",
  });
  element.classList.add("webskin-clock", "webskin-clock--analog-plain", ...String(className).split(/\s+/).filter(Boolean));
  element.dataset.webskinWidget = "clock";
  element.style.width = size;
  element.style.height = size;
  if (color) element.style.color = color;
  if (frameColor) element.style.setProperty("--webskin-analog-frame", frameColor);
  if (frameOpacity !== undefined) element.style.setProperty("--webskin-analog-frame-opacity", frameOpacity);
  if (faceColor) element.style.setProperty("--webskin-analog-face", faceColor);
  if (faceOpacity !== undefined) element.style.setProperty("--webskin-analog-face-opacity", faceOpacity);
  if (handsColor) element.style.setProperty("--webskin-analog-hands", handsColor);
  if (handsOpacity !== undefined) element.style.setProperty("--webskin-analog-hands-opacity", handsOpacity);
  if (hourHandColor ?? handsColor) element.style.setProperty("--webskin-analog-hour-hand", hourHandColor ?? handsColor);
  if ((hourHandOpacity ?? handsOpacity) !== undefined) element.style.setProperty("--webskin-analog-hour-hand-opacity", hourHandOpacity ?? handsOpacity);
  if (minuteHandColor ?? handsColor) element.style.setProperty("--webskin-analog-minute-hand", minuteHandColor ?? handsColor);
  if ((minuteHandOpacity ?? handsOpacity) !== undefined) element.style.setProperty("--webskin-analog-minute-hand-opacity", minuteHandOpacity ?? handsOpacity);
  if (secondHandColor ?? handsColor) element.style.setProperty("--webskin-analog-second-hand", secondHandColor ?? handsColor);
  if ((secondHandOpacity ?? handsOpacity) !== undefined) element.style.setProperty("--webskin-analog-second-hand-opacity", secondHandOpacity ?? handsOpacity);

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
    tick.hidden = !showTicks;
    element.append(tick);
  }

  const hourHand = svgElement("line", { x1: "50", y1: "50", x2: "50", y2: "27" });
  const minuteHand = svgElement("line", { x1: "50", y1: "50", x2: "50", y2: "16" });
  const secondHand = svgElement("line", { x1: "50", y1: "53", x2: "50", y2: "12" });
  hourHand.dataset.webskinClockPart = "hour-hand";
  minuteHand.dataset.webskinClockPart = "minute-hand";
  secondHand.dataset.webskinClockPart = "second-hand";
  hourHand.hidden = !showHourHand;
  minuteHand.hidden = !showMinuteHand;
  secondHand.hidden = !showSeconds || !showSecondHand;
  element.append(hourHand, minuteHand, secondHand);

  const pin = svgElement("circle", { cx: "50", cy: "50", r: "2.5" });
  pin.dataset.webskinClockPart = "pin";
  element.append(pin);

  const render = () => {
    const angles = clockAngles(new Date(Date.now() + Number(offsetMinutes) * 60_000));
    hourHand.setAttribute("transform", `rotate(${angles.hour} 50 50)`);
    minuteHand.setAttribute("transform", `rotate(${angles.minute} 50 50)`);
    secondHand.setAttribute("transform", `rotate(${angles.second} 50 50)`);
  };

  render();
  const timer = window.setInterval(render, 1000);
  Object.defineProperty(element, "destroy", {
    configurable: true,
    value: () => window.clearInterval(timer),
  });
  return element;
}
