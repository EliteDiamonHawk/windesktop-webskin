import { createClock as createPlainAnalogClock } from "./plain-analog.js";

const STYLE_ID = "webskin-clock-analog-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-clock--analog {
      --webskin-analog-color: #5b4841;
      --webskin-analog-face: #cfb5ab;
      --webskin-analog-frame: var(--webskin-analog-color);
      --webskin-analog-frame-opacity: 1;
      --webskin-analog-ticks: var(--webskin-analog-color);
      --webskin-analog-hands: var(--webskin-analog-color);
      --webskin-analog-hands-opacity: 1;
      --webskin-analog-face-opacity: 1;
      --webskin-analog-ticks-opacity: 1;
      background: var(--webskin-analog-color);
      border: 1px solid var(--webskin-analog-color);
      border-radius: .75rem;
      box-shadow: 0 .75rem 2rem rgb(0 0 0 / .18);
      display: inline-block;
      padding: .75rem;
    }
    .webskin-clock--analog [data-webskin-clock-part="face"] { stroke-width: 2; }
  `;
  document.head.append(style);
};

/** Create the WebSkin-provided pre-styled analog clock. */
export function createClock(options = {}) {
  ensureStyles();
  const element = createPlainAnalogClock(options);
  element.classList.add("webskin-clock--analog");
  if (options.color) {
    element.style.color = options.color;
    element.style.setProperty("--webskin-analog-color", options.color);
    element.style.setProperty("--webskin-analog-ticks", options.color);
    element.style.setProperty("--webskin-analog-hands", options.color);
  }
  if (options.faceColor) element.style.setProperty("--webskin-analog-face", options.faceColor);
  if (options.frameColor) element.style.setProperty("--webskin-analog-frame", options.frameColor);
  return element;
}
