import { createClock as createPlainClock } from "./plain.js";

const STYLE_ID = "webskin-clock-digital-styles";

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-clock--digital {
      --webskin-clock-color: #f5f7fb;
      align-items: baseline;
      background: #171b24;
      border: 1px solid color-mix(in srgb, var(--webskin-clock-color) 28%, transparent);
      border-radius: .75rem;
      box-shadow: 0 .75rem 2rem rgb(0 0 0 / .18);
      color: var(--webskin-clock-color);
      display: inline-flex;
      font: 600 clamp(1.5rem, 5vw, 3rem)/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      gap: .35rem;
      letter-spacing: .08em;
      padding: .75rem 1rem;
      white-space: nowrap;
    }
    .webskin-clock--digital [data-webskin-clock-part="separator"] { opacity: .55; }
    .webskin-clock--digital [data-webskin-clock-part="seconds"] { font-size: .62em; opacity: .72; }
    .webskin-clock--digital [data-webskin-clock-part="period"] { font-size: .45em; letter-spacing: .04em; opacity: .72; }
  `;
  document.head.append(style);
};

/** Create the WebSkin-provided pre-styled digital clock. */
export function createClock(options = {}) {
  ensureStyles();
  const element = createPlainClock({
    format: options.format ?? "24h",
    seconds: options.seconds ?? true,
    showPeriod: options.showPeriod ?? true,
  });
  element.classList.remove("webskin-clock--plain");
  element.classList.add("webskin-clock--digital");
  if (options.className) element.classList.add(...String(options.className).split(/\s+/).filter(Boolean));
  if (options.color) element.style.setProperty("--webskin-clock-color", options.color);
  return element;
}
