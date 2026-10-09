// Pre-styled single-day calendar view in the shared time widget category.
import { createDay as createPlainDay } from "./day-plain.js?v=calendar-date-5";

const STYLE_ID = "webskin-calendar-day-prestyled2-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-calendar--day-plain.webskin-calendar--day-prestyled2[data-webskin-calendar-variant="single-day"] {
      --webskin-calendar-color: #d6d6d6;
      --webskin-calendar-background: #2e2e2e;
      --webskin-calendar-border: var(--webskin-calendar-background);
      align-items: center;
      background: var(--webskin-calendar-background);
      border: 1px solid var(--webskin-calendar-border);
      border-radius: .75rem;
      box-sizing: border-box;
      box-shadow: 0 .75rem 2rem rgb(0 0 0 / .18);
      color: var(--webskin-calendar-color);
      display: inline-flex;
      gap: .25rem;
      justify-content: center;
      width: var(--webskin-calendar-width, 10rem);
      height: var(--webskin-calendar-height, 10rem);
      min-width: 0;
      min-height: 0;
      text-align: center;
    }
    :where(.webskin-calendar--day-prestyled2) {
      padding: var(--webskin-calendar-padding, 1rem 1.25rem);
    }
    .webskin-calendar--day-prestyled2 [data-webskin-calendar-part="weekday"] {
      color: var(--webskin-calendar-color);
      font-size: 1em;
      font-weight: 700;
      letter-spacing: .12em;
      opacity: .72;
      text-transform: uppercase;
    }
    .webskin-calendar--day-prestyled2 [data-webskin-calendar-part="day"] {
      font-size: 3.5em;
      font-weight: 700;
      line-height: .9;
    }
    .webskin-calendar--day-prestyled2 [data-webskin-calendar-part="month"],
    .webskin-calendar--day-prestyled2 [data-webskin-calendar-part="year"] {
      font-size: 1.1em;
      opacity: .78;
    }
  `;
  document.head.append(style);
};

/** Create the WebSkin-provided pre-styled single-day calendar. */
export function createDay(options = {}) {
  const element = createPlainDay({ ...options, variant: "single-day" });
  // Load this override after day-plain so the matching size rule wins without
  // changing the element shape returned by the shared day widget.
  ensureStyles();
  element.classList.add("webskin-calendar--day-prestyled2");
  if (options.color) element.style.setProperty("--webskin-calendar-color", options.color);
  if (options.backgroundColor) element.style.setProperty("--webskin-calendar-background", options.backgroundColor);
  return element;
}
