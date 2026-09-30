import { createClock as createPlainAnalogClock } from "./plain-analog.js";

const STYLE_ID = "webskin-clock-analog-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-clock--analog {
      --webskin-analog-ticks-opacity: .55;
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
  if (options.color) element.style.color = options.color;
  if (options.faceColor) element.style.setProperty("--webskin-analog-face", options.faceColor);
  if (options.frameColor) element.style.setProperty("--webskin-analog-frame", options.frameColor);
  return element;
}
