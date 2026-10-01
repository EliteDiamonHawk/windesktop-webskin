import { createClock as createPlainClock } from "./digital-plain.js";

const STYLE_ID = "webskin-clock-digital-prestyled-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-clock--digital-prestyled {
      --webskin-clock-color: #cfb5ab;
      --webskin-clock-background: #5b4841;
      align-items: baseline;
      background: var(--webskin-clock-background);
      border: 1px solid var(--webskin-clock-background);
      border-radius: .75rem;
      box-sizing: border-box;
      box-shadow: 0 .75rem 2rem rgb(0 0 0 / .18);
      color: var(--webskin-clock-color);
      display: inline-flex;
      font: 600 var(--webskin-clock-font-size, clamp(1.5rem, 5vw, 3rem))/1 "Segoe Print", "Comic Sans MS", cursive;
      font-variant-numeric: tabular-nums;
      gap: .35rem;
      letter-spacing: .08em;
      padding: .75rem 1rem;
      white-space: nowrap;
      width: var(--webskin-clock-width, 18ch);
      height: var(--webskin-clock-height, 2.5em);
      min-width: 0;
      min-height: 0;
    }
    .webskin-clock--digital-prestyled [data-webskin-clock-part="separator"] { opacity: .55; }
    .webskin-clock--digital-prestyled [data-webskin-clock-part="seconds"] { font-size: .62em; opacity: .72; }
    .webskin-clock--digital-prestyled [data-webskin-clock-part="period"] { font-size: .45em; letter-spacing: .04em; opacity: .72; }
  `;
  document.head.append(style);
};

/** Create the WebSkin-provided pre-styled digital clock. */
export function createClock(options = {}) {
  ensureStyles();
  const element = createPlainClock(options);
  element.classList.remove("webskin-clock--digital-plain");
  element.classList.add("webskin-clock--digital-prestyled");
  if (options.className) element.classList.add(...String(options.className).split(/\s+/).filter(Boolean));
  if (options.color) element.style.setProperty("--webskin-clock-color", options.color);
  if (options.backgroundColor) element.style.setProperty("--webskin-clock-background", options.backgroundColor);
  return element;
}
