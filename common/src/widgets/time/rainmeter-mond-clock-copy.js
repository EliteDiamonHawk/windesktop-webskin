import { Widget } from "../widgets.js";
import { createDate } from "./formatted-date-plain.js";
import { createClock as createDigitalClock } from "./digital-plain.js";

const STYLE_ID = "webskin-clock-rainmeter-mond-clock-copy-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @font-face {
      font-family: "WebSkin Mond Anurati";
      src: url("/common/fonts/Anurati.otf") format("opentype");
      font-style: normal;
      font-weight: 400;
      font-display: block;
    }
    @font-face {
      font-family: "WebSkin Mond Quicksand";
      src: url("/common/fonts/Quicksand.otf") format("opentype");
      font-style: normal;
      font-weight: 700;
      font-display: block;
    }
    .webskin-clock--rainmeter-mond-clock-copy {
      --webskin-mond-color: #000;
      --webskin-mond-width: 53.25rem;
      --webskin-mond-weekday-size: clamp(1.25rem, 9.2vw, 5rem);
      --webskin-mond-detail-size: clamp(.85rem, 2.7vw, 1.55rem);
      --webskin-mond-gap: clamp(.8rem, 3vw, 1.75rem);
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
    }
    .webskin-clock--rainmeter-mond-clock-copy [data-webskin-mond-part] {
      display: block;
      margin: 0;
      max-width: 100%;
      min-width: 0;
    }
    .webskin-clock--rainmeter-mond-clock-copy [data-webskin-mond-part="weekday"] {
      font-family: "WebSkin Mond Anurati", Anurati, sans-serif;
      font-size: clamp(1.25rem, 9.2vw, 5rem);
      font-size: var(--webskin-mond-weekday-size);
      font-weight: 400;
      letter-spacing: .08em;
      line-height: .82;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .webskin-clock--rainmeter-mond-clock-copy [data-webskin-mond-part="date"],
    .webskin-clock--rainmeter-mond-clock-copy [data-webskin-mond-part="time"] {
      font-family: "WebSkin Mond Quicksand", Quicksand, sans-serif;
      font-size: clamp(.85rem, 2.7vw, 1.55rem);
      font-size: var(--webskin-mond-detail-size);
      font-weight: 700;
      letter-spacing: .08em;
      line-height: 1;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .webskin-clock--rainmeter-mond-clock-copy .webskin-calendar,
    .webskin-clock--rainmeter-mond-clock-copy .webskin-clock {
      color: inherit;
      font: inherit;
      height: auto;
      min-height: 0;
      min-width: 0;
      width: auto;
    }
    .webskin-clock--rainmeter-mond-clock-copy [data-webskin-calendar-part],
    .webskin-clock--rainmeter-mond-clock-copy [data-webskin-clock-part] {
      color: inherit;
      font: inherit;
    }
    .webskin-clock--rainmeter-mond-clock-copy [data-webskin-calendar-part="separator"],
    .webskin-clock--rainmeter-mond-clock-copy [data-webskin-clock-part="separator"] {
      white-space: pre;
    }
    @supports (font-size: 1cqw) {
      .webskin-clock--rainmeter-mond-clock-copy {
        --webskin-mond-weekday-size: clamp(1.25rem, 9.2cqw, 5rem);
        --webskin-mond-detail-size: clamp(.85rem, 2.7cqw, 1.55rem);
        --webskin-mond-gap: clamp(.8rem, 3cqw, 1.75rem);
      }
    }
  `;
  document.head.append(style);
};

const createPart = (part) => {
  const element = document.createElement("div");
  element.dataset.webskinMondPart = part;
  return element;
};

class RainmeterMondClockCopy extends Widget {
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
      detailSize,
      gap,
    } = options;

    const element = document.createElement("section");
    super(element, { type: "clock" });
    element.className = [
      "webskin-clock",
      "webskin-clock--rainmeter-mond-clock-copy",
      className,
    ].filter(Boolean).join(" ");
    element.setAttribute("aria-label", "Current date and time");
    if (color) element.style.setProperty("--webskin-mond-color", color);
    if (width) element.style.setProperty("--webskin-mond-width", width);
    if (weekdaySize) element.style.setProperty("--webskin-mond-weekday-size", weekdaySize);
    if (detailSize) element.style.setProperty("--webskin-mond-detail-size", detailSize);
    if (gap) element.style.setProperty("--webskin-mond-gap", gap);

    const weekday = createPart("weekday");
    const calendarDate = createDate({
      date,
      locale,
      format: "dddd",
      className: "webskin-mond-clock__weekday",
    });
    weekday.append(calendarDate);

    const formattedDate = createPart("date");
    const dateWidget = createDate({
      date,
      locale,
      format: "DD MMMM, YYYY.",
      className: "webskin-mond-clock__date",
    });
    formattedDate.append(dateWidget);

    const time = createPart("time");
    const clockWidget = createDigitalClock({
      format: "12h",
      seconds: false,
      showPeriod: true,
      syntax: "- h:mm A -",
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
  return new RainmeterMondClockCopy(options).element;
}
