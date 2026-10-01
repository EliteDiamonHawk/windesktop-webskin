import { createClock as createPlainAnalogClock } from "./analog-plain.js";

const STYLE_ID = "webskin-clock-analog-prestyled-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-clock--analog-prestyled {
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
      width: var(--webskin-clock-width, 10rem);
      height: var(--webskin-clock-height, 10rem);
      padding: .75rem;
    }
    .webskin-clock--analog-prestyled [data-webskin-clock-part="face"] { stroke-width: 2; }
  `;
  document.head.append(style);
};

/** Create the WebSkin-provided pre-styled analog clock. */
export function createClock(options = {}) {
  ensureStyles();
  const element = createPlainAnalogClock({ ...options, smooth: options.smooth ?? true });
  element.classList.add("webskin-clock--analog-prestyled");
  if (options.color) element.style.setProperty("--webskin-analog-color", options.color);
  if (options.backgroundColor) element.style.setProperty("--webskin-analog-face", options.backgroundColor);
  return element;
}
