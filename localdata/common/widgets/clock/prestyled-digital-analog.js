import { createClock as createPrestyledDigital } from "./prestyled-digital.js";
import { createClock as createPrestyledAnalog } from "./prestyled-analog.js";

const STYLE_ID = "webskin-clock-prestyled-digital-analog-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-clock--prestyled-digital-analog {
      align-items: center;
      display: inline-flex;
      gap: 1rem;
    }
    .webskin-clock--prestyled-digital-analog > .webskin-clock--analog,
    .webskin-clock--prestyled-digital-analog > .webskin-clock--digital {
      flex: 0 0 auto;
    }
  `;
  document.head.append(style);
};

/** Create the WebSkin-provided pre-styled analog and digital combination. */
export function createClock(options = {}) {
  ensureStyles();
  const {
    format = "24h",
    seconds = true,
    showPeriod = true,
    syntax,
    offsetMinutes = 0,
    analogSize = "8rem",
    color,
    faceColor,
    frameColor,
    className = "",
  } = options;

  const element = document.createElement("div");
  element.className = ["webskin-clock", "webskin-clock--prestyled-digital-analog", className]
    .filter(Boolean)
    .join(" ");
  element.dataset.webskinWidget = "clock";

  const sharedOptions = { offsetMinutes };
  const analog = createPrestyledAnalog({
    ...sharedOptions,
    size: analogSize,
    color,
    faceColor,
    frameColor,
  });
  const digital = createPrestyledDigital({
    ...sharedOptions,
    format,
    seconds,
    showPeriod,
    syntax,
    color,
  });
  element.append(analog, digital);

  Object.defineProperty(element, "destroy", {
    configurable: true,
    value: () => {
      analog.destroy?.();
      digital.destroy?.();
    },
  });
  return element;
}
