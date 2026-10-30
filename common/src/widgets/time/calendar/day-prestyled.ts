import { createDay as createPlainDay } from "./day-plain.js?v=calendar-date-5";

const STYLE_ID = "webskin-calendar-day-prestyled-styles";
const WIDGET_SETTINGS_ID = "day-prestyled";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-calendar--day-prestyled {
      -webkit-user-select: none;
      user-select: none;
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
      font: 600 var(--webskin-calendar-font-size, clamp(1rem, 4vw, 2rem))/1 "Segoe Print", "Comic Sans MS", cursive;
      gap: .35rem;
      justify-content: center;
      padding: .75rem 1rem;
      white-space: nowrap;
      width: var(--webskin-calendar-width, 24rem);
      height: var(--webskin-calendar-height, 3.8rem);
      min-width: 0;
      min-height: 0;
    }
    .webskin-calendar--day-prestyled [data-webskin-calendar-part="separator"] { opacity: .55; }
  `;
  document.head.append(style);
};

export function createDay(options = {}) {
  ensureStyles();
  const element = createPlainDay({ ...options, variant: "formatted", widgetId: WIDGET_SETTINGS_ID, widgetVariant: "prestyled" });
  element.classList.add("webskin-calendar--day-prestyled");
  if (options.color) element.style.setProperty("--webskin-calendar-color", options.color);
  if (options.backgroundColor) element.style.setProperty("--webskin-calendar-background", options.backgroundColor);
  return element;
}
