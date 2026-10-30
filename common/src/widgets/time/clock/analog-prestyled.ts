import { createClock as createPlainAnalogClock } from "./analog-plain.js";

const STYLE_ID = "webskin-clock-analog-prestyled-styles";
const WIDGET_SETTINGS_ID = "analog-prestyled";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-clock--analog-prestyled {
      -webkit-user-select: none;
      user-select: none;
      --webskin-analog-color: #2e2e2e;
      --webskin-analog-face: #d6d6d6;
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

export function createClock(options = {}) {
  ensureStyles();
  const element = createPlainAnalogClock({
    ...options,
    smooth: options.smooth ?? true,
    widgetId: WIDGET_SETTINGS_ID,
    variant: "prestyled",
  });
  element.classList.add("webskin-clock--analog-prestyled");
  element.dataset.webskinWidgetVariant = "prestyled";
  if (options.color) element.style.setProperty("--webskin-analog-color", options.color);
  if (options.backgroundColor) element.style.setProperty("--webskin-analog-face", options.backgroundColor);
  return element;
}
