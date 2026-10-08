import { createClock as createDigitalPlain } from "./digital-plain.js";
import { createClock as createAnalogPlain } from "./analog-plain.js";
import { Widget } from "../widgets.js";

const STYLE_ID = "webskin-clock-digital-analog-prestyled-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-clock--digital-analog-prestyled {
      --webskin-combination-color: #d6d6d6;
      --webskin-combination-analog-color: #2e2e2e;
      --webskin-combination-analog-face: #d6d6d6;
      --webskin-combination-surface: #2e2e2e;
      align-items: center;
      background: var(--webskin-combination-surface);
      border: 1px solid var(--webskin-combination-surface);
      border-radius: .75rem;
      box-sizing: border-box;
      box-shadow: 0 .75rem 2rem rgb(0 0 0 / .18);
      display: inline-flex;
      flex-direction: row;
      flex-wrap: nowrap;
      gap: 1rem;
      justify-content: center;
      overflow: hidden;
      width: var(--webskin-clock-width, 22rem);
      height: var(--webskin-clock-height, 10rem);
      min-width: 0;
      min-height: 0;
      padding: .75rem 1rem;
    }
    .webskin-clock--digital-analog-prestyled > .webskin-clock--analog-plain,
    .webskin-clock--digital-analog-prestyled > .webskin-clock--digital-plain {
      flex: 0 0 auto;
    }
    .webskin-clock--digital-analog-prestyled > .webskin-clock--analog-plain { order: 1; }
    .webskin-clock--digital-analog-prestyled > .webskin-clock--digital-plain { order: 2; }
    .webskin-clock--digital-analog-prestyled > .webskin-clock--digital-plain {
      align-items: center;
      color: var(--webskin-combination-color);
      display: inline-flex;
      font: 600 var(--webskin-clock-font-size, clamp(1.5rem, 5vw, 3rem))/1 "Segoe Print", "Comic Sans MS", cursive;
      justify-content: center;
      letter-spacing: .08em;
      width: auto;
      height: auto;
      white-space: nowrap;
    }
    .webskin-clock--digital-analog-prestyled > .webskin-clock--analog-plain {
      --webskin-analog-frame: var(--webskin-combination-analog-face);
      --webskin-analog-face: var(--webskin-combination-analog-face);
      --webskin-analog-ticks: var(--webskin-combination-analog-color);
      --webskin-analog-hands: var(--webskin-combination-analog-color);
      --webskin-analog-ticks-display: var(--webskin-combination-analog-ticks-display, none);
      background: var(--webskin-combination-analog-face);
      border-radius: .75rem;
      box-shadow: none;
      width: 8rem;
      height: 8rem;
      padding: .65rem;
    }
    .webskin-clock--digital-analog-prestyled > .webskin-clock--analog-plain [data-webskin-clock-part="face"] { stroke-width: 1.5; }
    .webskin-clock--digital-analog-prestyled > .webskin-clock--analog-plain [data-webskin-clock-part="hour-hand"] { stroke-width: 5; }
    .webskin-clock--digital-analog-prestyled > .webskin-clock--analog-plain [data-webskin-clock-part="minute-hand"] { stroke-width: 3; }
    .webskin-clock--digital-analog-prestyled > .webskin-clock--analog-plain [data-webskin-clock-part="second-hand"] { stroke-width: 1.5; }
    .webskin-clock--digital-analog-prestyled > .webskin-clock--digital-plain [data-webskin-clock-part="separator"] { opacity: .55; }
    .webskin-clock--digital-analog-prestyled > .webskin-clock--digital-plain [data-webskin-clock-part="seconds"] { font-size: .62em; opacity: .72; }
    .webskin-clock--digital-analog-prestyled > .webskin-clock--digital-plain [data-webskin-clock-part="period"] { font-size: .45em; letter-spacing: .04em; opacity: .72; }
  `;
  document.head.append(style);
};

class DigitalAnalogClock extends Widget {
  constructor(options = {}) {
    ensureStyles();
    const {
      format = "24h",
      seconds = false,
      showPeriod = true,
      syntax,
      offsetMinutes = 0,
      smooth,
      color,
      backgroundColor,
      className = "",
    } = options;

    const element = document.createElement("div");
    super(element, { type: "clock" });
    element.className = ["webskin-clock", "webskin-clock--digital-analog-prestyled", className]
      .filter(Boolean)
      .join(" ");

    const sharedOptions = { offsetMinutes };
    const analog = createAnalogPlain({ ...sharedOptions, smooth: smooth ?? true });
    const digital = createDigitalPlain({
      ...sharedOptions,
      format,
      seconds,
      showPeriod,
      syntax,
    });
    analog.dataset.webskinClockPart = "analog";
    digital.dataset.webskinClockPart = "digital";
    element.append(analog, digital);
    if (color) element.style.setProperty("--webskin-combination-color", color);
    if (backgroundColor) {
      element.style.setProperty("--webskin-combination-analog-color", backgroundColor);
      element.style.setProperty("--webskin-combination-surface", backgroundColor);
    }
    if (color) element.style.setProperty("--webskin-combination-analog-face", color);

    this.addCleanup(() => {
      analog.destroy?.();
      digital.destroy?.();
    });
  }
}

/** Create the WebSkin-provided digital and reversed analog treatment. */
export function createClock(options = {}) {
  return new DigitalAnalogClock(options).element;
}
