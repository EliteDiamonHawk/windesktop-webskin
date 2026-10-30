import { smallWidgetFrame } from "../../../frames/small-widget-frame.js";
import { Widget } from "../../widgets.js";
import { createStopwatch as createPlainStopwatch } from "./stopwatch-plain.js";

const asset = (root, name) => {
  const image = document.createElement("span");
  const url = `/assets/${root}/${name}`;
  image.style.setProperty("background-color", "currentColor");
  image.style.setProperty("mask-image", `url("${url}")`);
  image.style.setProperty("mask-position", "center");
  image.style.setProperty("mask-repeat", "no-repeat");
  image.style.setProperty("mask-size", "contain");
  image.style.setProperty("-webkit-mask-image", `url("${url}")`);
  image.style.setProperty("-webkit-mask-position", "center");
  image.style.setProperty("-webkit-mask-repeat", "no-repeat");
  image.style.setProperty("-webkit-mask-size", "contain");
  image.setAttribute("aria-hidden", "true");
  return image;
};

const ensureStyles = () => {
  const styleId = "webskin-prestyled-timer-styles";
  if (document.getElementById?.(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    .webskin-timer--prestyled [data-webskin-frame-part="value"] { font-variant-numeric: tabular-nums; }
    .webskin-timer--prestyled [data-webskin-frame-part="actions"] { gap: .3rem; margin-top: .2rem; }
    .webskin-timer--prestyled [data-webskin-frame-part="actions"] button {
      background: var(--webskin-small-widget-color);
      border: 0;
      border-radius: .3rem;
      box-sizing: border-box;
      color: var(--webskin-small-widget-background);
      font: inherit;
      font-size: clamp(.55rem, 7cqw, .75rem);
      height: 1.35rem;
      min-width: 0;
      overflow: hidden;
      padding: 0 .3rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;
  document.head?.append(style);
};

export function createStopwatch(options = {}) {
  ensureStyles();
  const plain = createPlainStopwatch({ ...options, buttons: false });
  const display = plain.querySelector('[data-webskin-timer-part="display"]');
  const element = smallWidgetFrame({
    className: ["webskin-timer", "webskin-timer--stopwatch", "webskin-timer--prestyled", options.className].filter(Boolean).join(" "),
    subtext: options.label ?? "Stopwatch",
    icon: asset("icons", "stopwatch-svgrepo-com.svg"),
    iconFrame: asset("shapes", "flower.svg"),
    color: options.color,
    backgroundColor: options.backgroundColor,
    borderColor: options.borderColor,
    subtextColor: options.subtextColor,
    iconFrameColor: options.iconFrameColor,
    iconColor: options.iconColor,
  });
  const widget = new Widget(element, { type: "timer" });
  element.setAttribute("aria-live", "polite");
  element.dataset.webskinTimerType = "stopwatch";
  element.parts.value.append(display);

  let observer;
  const renderControls = () => {
    if (options.buttons === false) return;
    const state = plain.dataset.webskinTimerState;
    const started = plain.dataset.webskinTimerStarted === "true";
    const definitions = state === "running"
      ? [["Pause", "pause"]]
      : state === "finished"
        ? []
        : started ? [["Resume", "resume"]] : [["Play", "start"]];
    definitions.push(["Restart", "restart"]);
    element.parts.actions.replaceChildren();
    definitions.forEach(([label, method]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.webskinTimerControl = method;
      button.addEventListener("click", () => {
        plain[method]();
        renderControls();
      });
      element.parts.actions.append(button);
    });
  };
  if (typeof MutationObserver === "function") {
    observer = new MutationObserver(renderControls);
    observer.observe(plain, { attributes: true, attributeFilter: ["data-webskin-timer-state", "data-webskin-timer-started"] });
  }
  renderControls();

  for (const method of ["start", "pause", "resume", "restart", "setTime", "setLimit", "setUpdateInterval"]) {
    Object.defineProperty(element, method, {
      configurable: true,
      value: (...args) => {
        plain[method](...args);
        renderControls();
        return element;
      },
    });
  }
  widget.addCleanup(() => {
    observer?.disconnect();
    plain.destroy();
    element.parts.actions.replaceChildren();
  });
  return element;
}
