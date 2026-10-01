// Pre-styled calendar view in the shared time widget category.
import { createWeek as createPlainWeek } from "./week-plain.js?v=calendar-date-5";

const STYLE_ID = "webskin-calendar-week-prestyled-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-calendar--week-prestyled {
      --webskin-calendar-color: #cfb5ab;
      --webskin-calendar-background: #5b4841;
      --webskin-calendar-border: var(--webskin-calendar-background);
      --webskin-calendar-today-background: var(--webskin-calendar-color);
      --webskin-calendar-today-color: var(--webskin-calendar-background);
      --webskin-calendar-adjacent-opacity: .45;
      background: var(--webskin-calendar-background);
      border: 1px solid var(--webskin-calendar-border);
      border-radius: .75rem;
      box-sizing: border-box;
      box-shadow: 0 .75rem 2rem rgb(0 0 0 / .18);
      color: var(--webskin-calendar-color);
      display: inline-block;
      width: var(--webskin-calendar-width, 28rem);
      height: var(--webskin-calendar-height, 7rem);
      min-width: 0;
      min-height: 0;
      padding: .75rem;
    }
    .webskin-calendar--week-prestyled [data-webskin-calendar-part="week"] { gap: .2rem; }
    .webskin-calendar--week-prestyled [data-webskin-calendar-part="date-cell"] {
      gap: .35rem;
      border: 0;
      border-radius: .5rem;
      padding: .55rem .35rem;
    }
    .webskin-calendar--week-prestyled [data-webskin-calendar-part="weekday"] {
      color: var(--webskin-calendar-color);
      font-size: .68em;
      font-weight: 700;
      letter-spacing: .08em;
      opacity: .7;
      text-transform: uppercase;
    }
    .webskin-calendar--week-prestyled [data-webskin-calendar-part="weekday"][data-webskin-calendar-today="true"] {
      background: var(--webskin-calendar-background);
      border-radius: .3rem;
      color: var(--webskin-calendar-color);
      font-weight: 800;
      opacity: 1;
      padding: .12rem .25rem;
      text-decoration: none;
    }
    .webskin-calendar--week-prestyled [data-webskin-calendar-part="day"] { font-size: 1.2em; font-weight: 700; }
    .webskin-calendar--week-prestyled [data-webskin-calendar-part="month"] { font-size: .7em; opacity: .7; }
    .webskin-calendar--week-prestyled [data-webskin-calendar-today="true"] {
      background: var(--webskin-calendar-today-background);
      color: var(--webskin-calendar-today-color);
    }
  `;
  document.head.append(style);
};

/** Create the WebSkin-provided pre-styled calendar week. */
export function createWeek(options = {}) {
  ensureStyles();
  const element = createPlainWeek(options);
  element.classList.add("webskin-calendar--week-prestyled");
  if (options.color) element.style.setProperty("--webskin-calendar-color", options.color);
  if (options.backgroundColor) element.style.setProperty("--webskin-calendar-background", options.backgroundColor);
  return element;
}
