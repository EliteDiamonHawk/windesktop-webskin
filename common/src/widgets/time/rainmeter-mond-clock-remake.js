import { Widget } from "../widgets.js";
import { createDay } from "./day-plain.js";
import { createClock as createDigitalClock } from "./clock-digital-plain.js";

const STYLE_ID = "webskin-clock-rainmeter-mond-clock-remake-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @font-face {
      font-family: "WebSkin Mond Anurati";
      src: local("Anurati"),
        url("/common/assets/fonts/Anurati.otf") format("opentype");
      font-style: normal;
      font-weight: 400;
      font-display: block;
    }
    @font-face {
      font-family: "WebSkin Mond Quicksand";
      src: local("Quicksand"),
        url("/common/assets/fonts/Quicksand.otf") format("opentype");
      font-style: normal;
      font-weight: 700;
      font-display: block;
    }
    .webskin-clock--rainmeter-mond-clock-remake {
      --webskin-mond-color: #000;
      --webskin-mond-width: max-content;
      --webskin-mond-weekday-size: 5rem;
      --webskin-mond-weekday-letter-spacing: .4em;
      --webskin-mond-detail-size: 1.5rem;
      --webskin-mond-gap: 1.75rem;
      align-items: center;
      box-sizing: border-box;
      color: var(--webskin-mond-color);
      container-type: inline-size;
      display: flex;
      flex-direction: column;
      gap: var(--webskin-mond-gap);
      justify-content: center;
      margin: 0;
      max-width: 100%;
      min-width: 0;
      text-align: center;
      width: min(100%, var(--webskin-mond-width));
      zoom: 1.2;
    }
    .webskin-clock--rainmeter-mond-clock-remake [data-webskin-mond-part] {
      box-sizing: border-box;
      display: block;
      margin: 0;
      min-width: 0;
      text-align: center;
      width: 100%;
    }
    .webskin-clock--rainmeter-mond-clock-remake [data-webskin-mond-part="weekday"] {
      font-family: "WebSkin Mond Anurati", Anurati, sans-serif;
      font-size: var(--webskin-mond-weekday-size);
      font-weight: 400;
      letter-spacing: var(--webskin-mond-weekday-letter-spacing);
      line-height: .82;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .webskin-clock--rainmeter-mond-clock-remake [data-webskin-mond-part="date"],
    .webskin-clock--rainmeter-mond-clock-remake [data-webskin-mond-part="time"] {
      font-family: "WebSkin Mond Quicksand", Quicksand, sans-serif;
      font-size: var(--webskin-mond-detail-size);
      font-weight: 700;
      letter-spacing: .08em;
      line-height: 1;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .webskin-clock--rainmeter-mond-clock-remake [data-webskin-mond-part] > .webskin-calendar,
    .webskin-clock--rainmeter-mond-clock-remake [data-webskin-mond-part] > .webskin-clock {
      color: inherit;
      display: block;
      font: inherit;
      height: auto;
      justify-content: center;
      min-height: 0;
      min-width: 0;
      margin-inline: auto;
      padding: 0;
      text-align: center;
      text-indent: 0;
      width: 100%;
    }
    .webskin-clock--rainmeter-mond-clock-remake [data-webskin-calendar-part],
    .webskin-clock--rainmeter-mond-clock-remake [data-webskin-clock-part] {
      color: inherit;
      font: inherit;
    }
    .webskin-clock--rainmeter-mond-clock-remake [data-webskin-calendar-part="separator"],
    .webskin-clock--rainmeter-mond-clock-remake [data-webskin-clock-part="separator"] {
      white-space: pre;
    }
    .webskin-clock--rainmeter-mond-clock-remake [data-webskin-mond-part="time"] [data-webskin-clock-part="separator"]:first-child {
      margin-inline-end: .3em;
    }
    .webskin-clock--rainmeter-mond-clock-remake [data-webskin-mond-part="time"] [data-webskin-clock-part="separator"]:last-child {
      margin-inline-start: .3em;
    }
  `;
  document.head.append(style);
};

const createPart = (part) => {
  const element = document.createElement("div");
  element.dataset.webskinMondPart = part;
  return element;
};

class RainmeterMondClockRemake extends Widget {
  constructor(options = {}) {
    ensureStyles();
    const {
      date,
      locale,
      offsetMinutes = 0,
      className = "",
      color,
      width,
      weekdaySize,
      weekdayLetterSpacing,
      detailSize,
      gap,
    } = options;

    const element = document.createElement("section");
    super(element, { type: "clock" });
    element.className = [
      "webskin-clock",
      "webskin-clock--rainmeter-mond-clock-remake",
      className,
    ].filter(Boolean).join(" ");
    element.setAttribute("aria-label", "Current date and time");
    if (color) element.style.setProperty("--webskin-mond-color", color);
    if (width) element.style.setProperty("--webskin-mond-width", width);
    if (weekdaySize) element.style.setProperty("--webskin-mond-weekday-size", weekdaySize);
    if (weekdayLetterSpacing) element.style.setProperty("--webskin-mond-weekday-letter-spacing", weekdayLetterSpacing);
    if (detailSize) element.style.setProperty("--webskin-mond-detail-size", detailSize);
    if (gap) element.style.setProperty("--webskin-mond-gap", gap);

    const weekday = createPart("weekday");
    const calendarDate = createDay({
      date,
      locale,
      format: "dddd",
      className: "webskin-mond-clock__weekday",
    });
    weekday.append(calendarDate);

    const formattedDate = createPart("date");
    const dateWidget = createDay({
      date,
      locale,
      format: "DD MMMM, YYYY.     ",  //whitespace for centering
      className: "webskin-mond-clock__date",
    });
    formattedDate.append(dateWidget);

    const time = createPart("time");
    const clockWidget = createDigitalClock({
      format: "12h",
      seconds: false,
      showPeriod: true,
      syntax: "-h:mm A-     ",  //whitespace for centering
      offsetMinutes,
      className: "webskin-mond-clock__time",
    });
    time.append(clockWidget);

    element.append(weekday, formattedDate, time);
    this.addCleanup(() => calendarDate.destroy?.());
    this.addCleanup(() => dateWidget.destroy?.());
    this.addCleanup(() => clockWidget.destroy?.());
  }
}

/** Create the Rainmeter Mond-style composite clock. */
export function createClock(options = {}) {
  return new RainmeterMondClockRemake(options).element;
}
