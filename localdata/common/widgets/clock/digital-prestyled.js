import { createClock as createPlainClock } from "./digital-plain.js";

const STYLE_ID = "webskin-clock-digital-prestyled-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-clock--digital-prestyled {
      --webskin-clock-color: #cfb5ab;
      align-items: baseline;
      background: #5b4841;
      border: 1px solid #5b4841;
      border-radius: .75rem;
      box-shadow: 0 .75rem 2rem rgb(0 0 0 / .18);
      color: var(--webskin-clock-color);
      display: inline-flex;
      font: 600 clamp(1.5rem, 5vw, 3rem)/1 "Segoe Print", "Comic Sans MS", cursive;
      gap: .35rem;
      letter-spacing: .08em;
      padding: .75rem 1rem;
      white-space: nowrap;
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
  return element;
}
