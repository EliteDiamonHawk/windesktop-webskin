// Pre-styled calendar view in the shared time widget category.
import { createDate as createPlainDate } from "./formatted-date-plain.js?v=calendar-date-5";

const STYLE_ID = "webskin-calendar-formatted-date-prestyled-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-calendar--formatted-date-prestyled {
      --webskin-calendar-color: #cfb5ab;
      --webskin-calendar-background: #5b4841;
      --webskin-calendar-border: var(--webskin-calendar-background);
      align-items: baseline;
      background: var(--webskin-calendar-background);
      border: 1px solid var(--webskin-calendar-border);
      border-radius: .75rem;
      box-sizing: border-box;
      box-shadow: 0 .75rem 2rem rgb(0 0 0 / .18);
      color: var(--webskin-calendar-color);
      display: inline-flex;
      font: 600 var(--webskin-calendar-font-size, clamp(1rem, 4vw, 2rem))/1 "Segoe Print", "Comic Sans MS", cursive;
      gap: .35rem;
      padding: .75rem 1rem;
      white-space: nowrap;
      width: var(--webskin-calendar-width, 20rem);
      height: var(--webskin-calendar-height, 3.5rem);
      min-width: 0;
      min-height: 0;
    }
    .webskin-calendar--formatted-date-prestyled [data-webskin-calendar-part="separator"] { opacity: .55; }
  `;
  document.head.append(style);
};

/** Create the WebSkin-provided pre-styled formatted date. */
export function createDate(options = {}) {
  ensureStyles();
  const element = createPlainDate(options);
  element.classList.add("webskin-calendar--formatted-date-prestyled");
  if (options.color) element.style.setProperty("--webskin-calendar-color", options.color);
  if (options.backgroundColor) element.style.setProperty("--webskin-calendar-background", options.backgroundColor);
  return element;
}
