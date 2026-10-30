const STYLE_ID = "webskin-small-widget-frame-styles";

const COLOR_OPTIONS = {
  color: "--webskin-small-widget-color",
  backgroundColor: "--webskin-small-widget-background",
  borderColor: "--webskin-small-widget-border",
  subtextColor: "--webskin-small-widget-subtext-color",
  iconFrameColor: "--webskin-small-widget-icon-frame-color",
  iconColor: "--webskin-small-widget-icon-color",
};

const ensureStyles = () => {
  if (document.getElementById?.(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
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
      aspect-ratio: 11 / 10;
      background: var(--webskin-small-widget-background);
      border: 1px solid var(--webskin-small-widget-border);
      border-radius: .75rem;
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
      right: var(--webskin-small-widget-padding);
      top: var(--webskin-small-widget-padding);
      width: 30%;
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
      bottom: var(--webskin-small-widget-padding);
      display: flex;
      flex-direction: column;
      gap: .12rem;
      left: var(--webskin-small-widget-padding);
      max-width: calc(100% - (var(--webskin-small-widget-padding) * 2));
      position: absolute;
      right: var(--webskin-small-widget-padding);
    }

    .webskin-frame--small-widget [data-webskin-frame-part="value"],
    .webskin-frame--small-widget [data-webskin-frame-part="subtext"] {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .webskin-frame--small-widget [data-webskin-frame-part="value"] {
      color: var(--webskin-small-widget-color);
      font-size: clamp(1.25rem, 15cqw, 2.2rem);
      font-weight: 700;
      line-height: 1;
    }

    .webskin-frame--small-widget [data-webskin-frame-part="subtext"] {
      color: var(--webskin-small-widget-subtext-color);
      font-size: clamp(.8rem, 8cqw, 1.2rem);
      line-height: 1.1;
      opacity: .72;
    }

    .webskin-frame--small-widget [data-webskin-frame-part="actions"] {
      display: grid;
      gap: .35rem;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: .25rem;
      width: 100%;
    }

    .webskin-frame--small-widget [data-webskin-frame-part="value"]:empty,
    .webskin-frame--small-widget [data-webskin-frame-part="subtext"]:empty,
    .webskin-frame--small-widget [data-webskin-frame-part="actions"]:empty {
      display: none;
    }
  `;
  document.head.append(style);
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
  element.className = [
    "webskin-frame",
    "webskin-frame--small-widget",
    options.className,
  ].filter(Boolean).join(" ");
  element.dataset.webskinFrame = "small-widget-frame";

  const iconArea = createPart("icon-area");
  const iconFrame = createPart("icon-frame");
  const icon = createPart("icon");
  const content = createPart("content");
  const value = createPart("value", "span");
  const subtext = createPart("subtext", "span");
  const actions = createPart("actions");

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

  return element;
}


