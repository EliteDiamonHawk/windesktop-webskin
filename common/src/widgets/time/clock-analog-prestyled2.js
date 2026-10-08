import { createClock as createPlainAnalogClock } from "./clock-analog-plain.js";

const STYLE_ID = "webskin-clock-analog-prestyled2-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    svg.webskin-clock--analog-prestyled2 {
      --webskin-analog2-color: #2e2e2e;
      --webskin-analog2-accent: #d6d6d6;
      --webskin-analog2-face: #2e2e2e;
      --webskin-analog2-frame: #2e2e2e;
      --webskin-analog2-shadow: rgb(46 46 46 / .42);
      background: var(--webskin-analog2-face);
      border: 1px solid var(--webskin-analog2-frame);
      border-radius: .75rem;
      box-shadow:
        0 0 0 .2rem #2e2e2e,
        0 .9rem 2rem var(--webskin-analog2-shadow),
        inset 0 0 0 .35rem rgb(46 46 46 / .3);
      width: var(--webskin-clock-width, 10rem);
      height: var(--webskin-clock-height, 10rem);
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
      stroke: var(--webskin-analog2-accent);
      stroke-linecap: round;
    }
    svg.webskin-clock--analog-prestyled2 [data-webskin-clock-part="hour-hand"] { stroke-width: 5; }
    svg.webskin-clock--analog-prestyled2 [data-webskin-clock-part="minute-hand"] { stroke-width: 3; }
    svg.webskin-clock--analog-prestyled2 [data-webskin-clock-part="second-hand"] {
      stroke: var(--webskin-analog2-accent);
      stroke-linecap: round;
      stroke-width: 1.5;
    }
    svg.webskin-clock--analog-prestyled2 [data-webskin-clock-part="pin"] {
      fill: var(--webskin-analog2-color);
      stroke: var(--webskin-analog2-face);
      stroke-width: 1;
    }
    svg.webskin-clock--analog-prestyled2 [data-webskin-clock-part="tick"] {
      display: var(--webskin-analog2-ticks-display, none);
    }
  `;
  document.head.append(style);
};

/** Create the WebSkin-provided second pre-styled analog clock treatment. */
export function createClock(options = {}) {
  const element = createPlainAnalogClock({ ...options, smooth: options.smooth ?? true });
  ensureStyles();
  element.classList.add("webskin-clock--analog-prestyled2");
  if (options.color) element.style.setProperty("--webskin-analog2-accent", options.color);
  if (options.backgroundColor) {
    element.style.setProperty("--webskin-analog2-color", options.backgroundColor);
    element.style.setProperty("--webskin-analog2-face", options.backgroundColor);
    element.style.setProperty("--webskin-analog2-frame", options.backgroundColor);
  }
  return element;
}
