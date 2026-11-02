import { classNames, ensureStyle } from "../widgets/dom.js";

const STYLE_ID = "webskin-small-widget-frame-styles";

const COLOR_OPTIONS = {
  color: "--webskin-small-widget-color",
  backgroundColor: "--webskin-small-widget-background",
  borderColor: "--webskin-small-widget-border",
  subtextColor: "--webskin-small-widget-subtext-color",
  iconFrameColor: "--webskin-small-widget-icon-frame-color",
  iconColor: "--webskin-small-widget-icon-color",
};

const MAX_BUTTONS = 2;

const normalizeButtons = (buttons) => {
  if (buttons === undefined) return [];
  if (!Array.isArray(buttons)) throw new TypeError("smallWidgetFrame buttons must be an array");
  if (buttons.length > MAX_BUTTONS) throw new RangeError("smallWidgetFrame supports at most two buttons");
  return buttons.map((button, index) => {
    if (!button || typeof button !== "object") {
      throw new TypeError("smallWidgetFrame button " + index + " must be an object");
    }
    if (typeof button.text !== "string") {
      throw new TypeError("smallWidgetFrame button " + index + " text must be a string");
    }
    if (typeof button.onClick !== "function") {
      throw new TypeError("smallWidgetFrame button " + index + " onClick must be a function");
    }
    return { text: button.text, onClick: button.onClick };
  });
};

const ensureStyles = () => {
  ensureStyle(STYLE_ID, `
    .webskin-frame--small-widget {
      -webkit-user-select: none;
      user-select: none;
      --webskin-small-widget-color: #d6d6d6;
      --webskin-small-widget-background: #2e2e2e;
      --webskin-small-widget-border: var(--webskin-small-widget-background);
      --webskin-small-widget-subtext-color: var(--webskin-small-widget-color);
      --webskin-small-widget-icon-frame-color: var(--webskin-small-widget-color);
      --webskin-small-widget-icon-color: var(--webskin-small-widget-background);
      --webskin-small-widget-shadow: 0 .75rem 2rem rgb(0 0 0 / .18);
      --webskin-small-widget-width: 11rem;
      --webskin-small-widget-padding: .9rem;
      --webskin-small-widget-content-left: 10.6534cqw;
      --webskin-small-widget-icon-right: 10.6534cqw;
      --webskin-small-widget-icon-top: 10.9375%;
      --webskin-small-widget-content-top: 55.46875%;
      --webskin-small-widget-content-bottom: 14.84375%;
      --webskin-small-widget-content-gap: 0cqw;
      --webskin-small-widget-button-color: color-mix(in srgb, var(--webskin-small-widget-background) 87.5%, white 12.5%);
      --webskin-small-widget-button-text-color: color-mix(in srgb, var(--webskin-small-widget-color) 75%, white 25%);
      aspect-ratio: 11 / 10;
      background: var(--webskin-small-widget-background);
      border: 1px solid var(--webskin-small-widget-border);
      border-radius: 40px;
      box-shadow: var(--webskin-small-widget-shadow);
      box-sizing: border-box;
      color: var(--webskin-small-widget-color);
      container-type: inline-size;
      display: inline-block;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      position: relative;
      vertical-align: top;
      width: var(--webskin-small-widget-width);
    }

    .webskin-frame--small-widget [data-webskin-frame-part="icon-area"] {
      aspect-ratio: 1;
      position: absolute;
      right: var(--webskin-small-widget-icon-right);
      top: var(--webskin-small-widget-icon-top);
      width: 27%;
    }

    .webskin-frame--small-widget [data-webskin-frame-part="icon"],
    .webskin-frame--small-widget [data-webskin-frame-part="icon-frame"] {
      align-items: center;
      display: grid;
      inset: 0;
      justify-items: center;
      position: absolute;
    }

    .webskin-frame--small-widget [data-webskin-frame-part="icon-frame"] {
      color: var(--webskin-small-widget-icon-frame-color);
    }

    .webskin-frame--small-widget [data-webskin-frame-part="icon"] {
      color: var(--webskin-small-widget-icon-color);
    }

    .webskin-frame--small-widget [data-webskin-frame-part="icon-frame"] > *,
    .webskin-frame--small-widget [data-webskin-frame-part="icon"] > * {
      display: block;
      max-height: 100%;
      max-width: 100%;
    }

    .webskin-frame--small-widget [data-webskin-frame-part="icon-frame"] > * {
      height: 100%;
      width: 100%;
    }

    .webskin-frame--small-widget [data-webskin-frame-part="icon"] > * {
      height: 58%;
      width: 58%;
    }

    .webskin-frame--small-widget [data-webskin-frame-part="content"] {
      bottom: var(--webskin-small-widget-content-bottom);
      display: flex;
      flex-direction: column;
      gap: var(--webskin-small-widget-content-gap);
      left: var(--webskin-small-widget-content-left);
      max-width: calc(100% - (var(--webskin-small-widget-padding) * 2));
      position: absolute;
      right: var(--webskin-small-widget-padding);
    }

    .webskin-frame--small-widget [data-webskin-frame-part="value"],
    .webskin-frame--small-widget [data-webskin-frame-part="subtext"] {
      flex-shrink: 0;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .webskin-frame--small-widget [data-webskin-frame-part="value"] {
      color: var(--webskin-small-widget-color);
      font-size: 20cqw;
      font-weight: 700;
      line-height: 1;
    }

    .webskin-frame--small-widget [data-webskin-frame-part="subtext"] {
      color: var(--webskin-small-widget-subtext-color);
      font-size: 12cqw;
      line-height: 1;
      margin-bottom: -.12em;
      opacity: .72;
      padding-bottom: .12em;
    }

    .webskin-frame--small-widget [data-webskin-frame-part="actions"] {
      display: grid;
      flex-shrink: 0;
      gap: 7.10227cqw;
      grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
      width: calc(100% - var(--webskin-small-widget-content-left) + var(--webskin-small-widget-padding));
    }

    .webskin-frame--small-widget [data-webskin-frame-part="actions"] > button {
      appearance: none;
      background: var(--webskin-small-widget-button-color);
      border: 1px solid var(--webskin-small-widget-button-color);
      border-radius: 999px;
      box-sizing: border-box;
      color: var(--webskin-small-widget-button-text-color);
      flex-shrink: 0;
      font: inherit;
      font-size: .75rem;
      font-weight: 600;
      height: 1.35rem;
      min-width: 0;
      overflow: hidden;
      padding: 0 .3rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .webskin-frame--small-widget [data-webskin-frame-part="value"]:empty,
    .webskin-frame--small-widget [data-webskin-frame-part="subtext"]:empty,
    .webskin-frame--small-widget [data-webskin-frame-part="actions"]:empty {
      display: none;
    }
  `);
};

const createPart = (name, tagName = "div") => {
  const element = document.createElement(tagName);
  element.dataset.webskinFramePart = name;
  return element;
};

const setInitialText = (element, value) => {
  if (value !== undefined && value !== null) element.textContent = String(value);
};


export function smallWidgetFrame(options = {}) {
  ensureStyles();

  const element = document.createElement("section");
  element.className = classNames(
    "webskin-frame",
    "webskin-frame--small-widget",
    options.className,
  );
  element.dataset.webskinFrame = "small-widget-frame";

  const iconArea = createPart("icon-area");
  const iconFrame = createPart("icon-frame");
  const icon = createPart("icon");
  const content = createPart("content");
  const value = createPart("value", "span");
  const subtext = createPart("subtext", "span");
  const actions = createPart("actions");
  const buttonStates = [];

  if (options.iconFrame !== undefined && options.iconFrame !== null) {
    iconFrame.append(options.iconFrame);
  }
  if (options.icon !== undefined && options.icon !== null) {
    icon.append(options.icon);
  }
  setInitialText(value, options.value);
  setInitialText(subtext, options.subtext);

  iconArea.append(iconFrame, icon);
  content.append(value, subtext, actions);
  element.append(iconArea, content);

  const setButtons = (buttons) => {
    const definitions = normalizeButtons(buttons);
    const nextButtons = definitions.map((definition, index) => {
      const button = buttonStates[index]?.element ?? document.createElement("button");
      const previous = buttonStates[index];
      if (previous) button.removeEventListener("click", previous.handler);
      button.type = "button";
      button.textContent = definition.text;
      const handler = (event) => definition.onClick(event, element);
      button.addEventListener("click", handler);
      buttonStates[index] = { element: button, handler, text: definition.text, onClick: definition.onClick };
      return button;
    });
    for (let index = definitions.length; index < buttonStates.length; index += 1) {
      buttonStates[index].element.removeEventListener("click", buttonStates[index].handler);
    }
    buttonStates.splice(definitions.length);
    actions.replaceChildren(...nextButtons);
    return element;
  };

  const updateButton = (index, patch) => {
    if (!Number.isInteger(index) || index < 0 || index >= buttonStates.length) {
      throw new RangeError("smallWidgetFrame button index is out of range");
    }
    if (!patch || typeof patch !== "object") {
      throw new TypeError("smallWidgetFrame button update must be an object");
    }
    const state = buttonStates[index];
    if (patch.text !== undefined) {
      if (typeof patch.text !== "string") throw new TypeError("smallWidgetFrame button text must be a string");
      state.text = patch.text;
      state.element.textContent = patch.text;
    }
    if (patch.onClick !== undefined) {
      if (typeof patch.onClick !== "function") throw new TypeError("smallWidgetFrame button onClick must be a function");
      state.element.removeEventListener("click", state.handler);
      state.onClick = patch.onClick;
      state.handler = (event) => state.onClick(event, element);
      state.element.addEventListener("click", state.handler);
    }
    return element;
  };

  for (const [optionName, propertyName] of Object.entries(COLOR_OPTIONS)) {
    if (options[optionName] !== undefined) {
      element.style.setProperty(propertyName, String(options[optionName]));
    }
  }

  Object.defineProperty(element, "parts", {
    configurable: false,
    enumerable: true,
    value: Object.freeze({ value, subtext, icon, iconFrame, actions }),
  });

  Object.defineProperty(element, "setButtons", { configurable: true, value: setButtons });
  Object.defineProperty(element, "updateButton", { configurable: true, value: updateButton });
  setButtons(options.buttons);

  return element;
}


