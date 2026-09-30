import { createClock as createPlainAnalogClock } from "./analog-plain.js";

const STYLE_ID = "webskin-clock-analog-prestyled2-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    svg.webskin-clock--analog-prestyled2 {
      --webskin-analog2-color: #5b4841;
      --webskin-analog2-face: #5b4841;
      --webskin-analog2-frame: #5b4841;
      --webskin-analog2-shadow: rgb(91 72 65 / .42);
      background: var(--webskin-analog2-face);
      border: 1px solid var(--webskin-analog2-frame);
      border-radius: .75rem;
      box-shadow:
        0 0 0 .2rem #5b4841,
        0 .9rem 2rem var(--webskin-analog2-shadow),
        inset 0 0 0 .35rem rgb(91 72 65 / .3);
      padding: .55rem;
    }
    svg.webskin-clock--analog-prestyled2 [data-webskin-clock-part="face"] {
      fill: var(--webskin-analog2-face);
      stroke: var(--webskin-analog2-frame);
      stroke-width: 1.5;
    }
    svg.webskin-clock--analog-prestyled2 [data-webskin-clock-part="tick"] {
      stroke: var(--webskin-analog2-color);
      stroke-width: 2;
      stroke-linecap: round;
    }
    svg.webskin-clock--analog-prestyled2 [data-webskin-clock-part="hour-hand"],
    svg.webskin-clock--analog-prestyled2 [data-webskin-clock-part="minute-hand"] {
      stroke: #cfb5ab;
      stroke-linecap: round;
    }
    svg.webskin-clock--analog-prestyled2 [data-webskin-clock-part="hour-hand"] { stroke-width: 5; }
    svg.webskin-clock--analog-prestyled2 [data-webskin-clock-part="minute-hand"] { stroke-width: 3; }
    svg.webskin-clock--analog-prestyled2 [data-webskin-clock-part="second-hand"] {
      stroke: #cfb5ab;
      stroke-linecap: round;
      stroke-width: 1.5;
    }
    svg.webskin-clock--analog-prestyled2 [data-webskin-clock-part="pin"] {
      fill: var(--webskin-analog2-color);
      stroke: var(--webskin-analog2-face);
      stroke-width: 1;
    }
  `;
  document.head.append(style);
};

/** Create the WebSkin-provided second pre-styled analog clock treatment. */
export function createClock(options = {}) {
  const element = createPlainAnalogClock({
    showTicks: false,
    handsColor: "#cfb5ab",
    hourHandColor: "#cfb5ab",
    minuteHandColor: "#cfb5ab",
    secondHandColor: "#cfb5ab",
    ...options,
  });
  ensureStyles();
  element.classList.add("webskin-clock--analog-prestyled2");

  const color = options.color ?? options.handsColor;
  if (color) element.style.setProperty("--webskin-analog2-color", color);
  if (options.faceColor) element.style.setProperty("--webskin-analog2-face", options.faceColor);
  if (options.frameColor) element.style.setProperty("--webskin-analog2-frame", options.frameColor);
  if (options.secondHandColor) element.style.setProperty("--webskin-analog2-second-hand", options.secondHandColor);
  if (options.shadowColor) element.style.setProperty("--webskin-analog2-shadow", options.shadowColor);
  return element;
}
