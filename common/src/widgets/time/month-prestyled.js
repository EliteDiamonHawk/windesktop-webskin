// Pre-styled calendar view in the shared time widget category.
import { createMonth as createPlainMonth } from "./month-plain.js?v=calendar-date-5";

const STYLE_ID = "webskin-calendar-month-prestyled-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-calendar--month-prestyled {
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
      display: inline-flex;
      flex-direction: column;
      justify-content: center;
      width: var(--webskin-calendar-width, 22rem);
      height: var(--webskin-calendar-height, 20rem);
      min-width: 0;
      min-height: 0;
      padding: .85rem;
    }
    .webskin-calendar--month-prestyled[data-webskin-calendar-max-weeks="5"] {
      height: var(--webskin-calendar-height, 18rem);
    }
    .webskin-calendar--month-prestyled [data-webskin-calendar-part="month-heading"] {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: .6rem;
      font-weight: 700;
    }
    .webskin-calendar--month-prestyled [data-webskin-calendar-part="weekday-headings"] { opacity: .7; }
    .webskin-calendar--month-prestyled [data-webskin-calendar-part="weekday-heading"] {
      color: var(--webskin-calendar-color);
      padding: .3rem .15rem;
      font-size: .68em;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .webskin-calendar--month-prestyled [data-webskin-calendar-part="month-grid"] { gap: .2rem; }
    .webskin-calendar--month-prestyled [data-webskin-calendar-part="date-cell"] {
      min-height: 2.15rem;
      border-radius: .45rem;
      padding: .35rem .15rem;
    }
    .webskin-calendar--month-prestyled [data-webskin-calendar-part="day"] { font-weight: 700; }
    .webskin-calendar--month-prestyled [data-webskin-calendar-in-month="false"] {
      opacity: var(--webskin-calendar-adjacent-opacity);
    }
    .webskin-calendar--month-prestyled [data-webskin-calendar-today="true"] {
      background: var(--webskin-calendar-today-background);
      color: var(--webskin-calendar-today-color);
      opacity: 1;
    }
  `;
  document.head.append(style);
};

/** Create the WebSkin-provided pre-styled month calendar. */
export function createMonth(options = {}) {
  ensureStyles();
  const element = createPlainMonth(options);
  element.classList.add("webskin-calendar--month-prestyled");
  if (options.color) element.style.setProperty("--webskin-calendar-color", options.color);
  if (options.backgroundColor) element.style.setProperty("--webskin-calendar-background", options.backgroundColor);
  return element;
}
