// Pre-styled calendar view in the shared time widget category.
import { createDay as createPlainDay } from "./single-day-plain.js";

const STYLE_ID = "webskin-calendar-single-day-prestyled-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-calendar--single-day-prestyled {
      --webskin-calendar-color: #cfb5ab;
      --webskin-calendar-background: #5b4841;
      --webskin-calendar-border: var(--webskin-calendar-background);
      align-items: center;
      background: var(--webskin-calendar-background);
      border: 1px solid var(--webskin-calendar-border);
      border-radius: .75rem;
      box-shadow: 0 .75rem 2rem rgb(0 0 0 / .18);
      color: var(--webskin-calendar-color);
      display: inline-flex;
      gap: .25rem;
      min-width: 9rem;
      padding: 1rem 1.25rem;
      text-align: center;
    }
    .webskin-calendar--single-day-prestyled [data-webskin-calendar-part="weekday"] {
      color: var(--webskin-calendar-color);
      font-size: .72em;
      font-weight: 700;
      letter-spacing: .12em;
      opacity: .72;
      text-transform: uppercase;
    }
    .webskin-calendar--single-day-prestyled [data-webskin-calendar-part="day"] {
      font-size: 3.5em;
      font-weight: 700;
      line-height: .9;
    }
    .webskin-calendar--single-day-prestyled [data-webskin-calendar-part="month"],
    .webskin-calendar--single-day-prestyled [data-webskin-calendar-part="year"] {
      font-size: .82em;
      opacity: .78;
    }
  `;
  document.head.append(style);
};

/** Create the WebSkin-provided pre-styled single-day calendar. */
export function createDay(options = {}) {
  ensureStyles();
  const element = createPlainDay(options);
  element.classList.add("webskin-calendar--single-day-prestyled");
  if (options.color) element.style.setProperty("--webskin-calendar-color", options.color);
  if (options.backgroundColor) element.style.setProperty("--webskin-calendar-background", options.backgroundColor);
  return element;
}
