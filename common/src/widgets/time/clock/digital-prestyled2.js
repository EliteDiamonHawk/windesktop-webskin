import { Widget } from "../../widgets.js";
import { subscribeClock, validateUpdateInterval } from "../time-scheduler.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const STYLE_ID = "webskin-clock-digital-prestyled2-styles";
const WIDGET_SETTINGS_ID = "digital-prestyled2";
const ASSET_ROOT = "/common/assets/fonts/google-sans-flex-numeral-svg";
const VIEWBOX_WIDTH = 100;
const VIEWBOX_Y = -40;
const VIEWBOX_HEIGHT = 220;
const GLYPH_HEIGHT = 84;
const MASK_SCALE = 1.04;
const GLYPH_POSITIONS = [
  // Adjust x values for column spacing and y values for row spacing.
  { x: 0, y: 0 },
  { x: 60, y: 0 },
  { x: 0, y: 75 },
  { x: 60, y: 75 },
];
const NUMERAL_DIMENSIONS = Object.freeze({
  0: { width: 60.152, height: 75.304 },
  1: { width: 38.75, height: 71.6 },
  2: { width: 53.9, height: 73.451 },
  3: { width: 55.052, height: 75.301 },
  4: { width: 57.6, height: 71.6 },
  5: { width: 55.551, height: 73.451 },
  6: { width: 57.552, height: 76.701 },
  7: { width: 50.15, height: 74.1 },
  8: { width: 55.805, height: 75.302 },
  9: { width: 57.552, height: 76.701 },
});
let nextMaskId = 0;

const svgElement = (tag, attributes = {}) => {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
};

const assetUrl = (digit) => `${ASSET_ROOT}/google-sans-flex-${digit}.svg`;

const glyphWidth = (digit) => {
  const dimensions = NUMERAL_DIMENSIONS[digit];
  return GLYPH_HEIGHT * dimensions.width / dimensions.height;
};

const centeredScale = (x, y, width, height) => {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  return `translate(${centerX} ${centerY}) scale(${MASK_SCALE}) translate(${-centerX} ${-centerY})`;
};

const imageElement = ({ digit, x, y, scale = 1, filter }) => {
  const width = glyphWidth(digit);
  const image = svgElement("image", {
    x,
    y,
    width,
    height: GLYPH_HEIGHT,
    href: assetUrl(digit),
    "xlink:href": assetUrl(digit),
    preserveAspectRatio: "xMinYMin meet",
    "data-webskin-clock-digit": digit,
  });
  if (filter) image.setAttribute("filter", `url(#${filter})`);
  if (scale !== 1) image.setAttribute("transform", centeredScale(x, y, width, GLYPH_HEIGHT));
  return image;
};

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .webskin-clock--digital-prestyled2 {
      -webkit-user-select: none;
      user-select: none;
      --webskin-digital2-color: #2e2e2e;
      --webskin-digital2-accent: #d6d6d6;
      --webskin-digital2-background: transparent;
      --webskin-digital2-shadow: rgb(46 46 46 / .38);
      background: var(--webskin-digital2-background);
      box-sizing: border-box;
      color: var(--webskin-digital2-color);
      display: inline-block;
      filter: drop-shadow(4px 5px 8px var(--webskin-digital2-shadow));
      height: var(--webskin-clock-height, 11rem);
      min-height: 0;
      min-width: 0;
      overflow: visible;
      width: var(--webskin-clock-width, 8rem);
    }
    .webskin-clock--digital-prestyled2 > svg {
      display: block;
      height: 100%;
      overflow: visible;
      width: 100%;
    }
    .webskin-clock--digital-prestyled2 [data-webskin-clock-part="digit"] {
      paint-order: fill;
    }
    .webskin-clock--digital-prestyled2 [data-webskin-clock-layer="0"],
    .webskin-clock--digital-prestyled2 [data-webskin-clock-layer="3"] {
      fill: var(--webskin-digital2-accent);
    }
    .webskin-clock--digital-prestyled2 [data-webskin-clock-layer="1"],
    .webskin-clock--digital-prestyled2 [data-webskin-clock-layer="2"] {
      fill: var(--webskin-digital2-color);
    }
    .webskin-clock--digital-prestyled2.is-blur {
      backdrop-filter: blur(8px) saturate(.72);
      -webkit-backdrop-filter: blur(8px) saturate(.72);
    }
    .webskin-clock--digital-prestyled2.is-blur [data-webskin-clock-part="digit"] {
      fill-opacity: .7;
      filter: blur(1.1px);
    }
    .webskin-clock--digital-prestyled2.is-blur [data-webskin-clock-layer="1"],
    .webskin-clock--digital-prestyled2.is-blur [data-webskin-clock-layer="2"] {
      fill-opacity: .84;
    }
    @supports not (backdrop-filter: blur(1px)) {
      .webskin-clock--digital-prestyled2.is-blur [data-webskin-clock-part="digit"] {
        filter: none;
        fill-opacity: 1;
      }
    }
  `;
  document.head.append(style);
};

const createInvertFilter = (filterId) => {
  const filter = svgElement("filter", {
    id: filterId,
    colorInterpolationFilters: "sRGB",
  });
  filter.append(svgElement("feColorMatrix", {
    type: "matrix",
    values: "-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0",
  }));
  return filter;
};

const createMask = (index, digits, maskId, invertFilterId) => {
  const mask = svgElement("mask", {
    id: maskId,
    maskUnits: "userSpaceOnUse",
    maskContentUnits: "userSpaceOnUse",
    "mask-type": "luminance",
    style: "mask-type: luminance",
    x: 0,
    y: VIEWBOX_Y,
    width: VIEWBOX_WIDTH,
    height: VIEWBOX_HEIGHT,
  });
  mask.append(imageElement({
    digit: digits[index],
    ...GLYPH_POSITIONS[index],
    filter: invertFilterId,
  }));

  for (let coveredIndex = index + 1; coveredIndex < digits.length; coveredIndex += 1) {
    mask.append(imageElement({
      digit: digits[coveredIndex],
      ...GLYPH_POSITIONS[coveredIndex],
      scale: MASK_SCALE,
    }));
  }
  return mask;
};

const digitsFor = (now) => [
  String(now.getHours()).padStart(2, "0")[0],
  String(now.getHours()).padStart(2, "0")[1],
  String(now.getMinutes()).padStart(2, "0")[0],
  String(now.getMinutes()).padStart(2, "0")[1],
];

class DigitalPrestyled2Clock extends Widget {
  constructor(options = {}) {
    ensureStyles();
    const {
      offsetMinutes = 0,
      updateInterval,
      className = "",
      color,
      backgroundColor,
      blur = false,
    } = options;
    validateUpdateInterval(updateInterval);

    const element = document.createElement("time");
    super(element, { type: "clock" });
    element.className = [
      "webskin-clock",
      "webskin-clock--digital-prestyled2",
      blur ? "is-blur" : "",
      className,
    ].filter(Boolean).join(" ");
    element.setAttribute("aria-label", "Current time");

    const svg = svgElement("svg", {
      viewBox: `0 ${VIEWBOX_Y} ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`,
      role: "img",
      "aria-hidden": "true",
      preserveAspectRatio: "xMidYMin meet",
    });
    const defs = svgElement("defs");
    const invertFilterId = `webskin-digital2-invert-${nextMaskId++}`;
    defs.append(createInvertFilter(invertFilterId));
    const glyphGroup = svgElement("g");
    const glyphs = [];
    let masks = [];

    const render = (snapshot = new Date()) => {
      const now = new Date(snapshot.getTime() + Number(offsetMinutes) * 60_000);
      const digits = digitsFor(now);
      masks.forEach((mask) => mask.remove?.());
      masks = digits.map((_, index) => {
        const maskId = `webskin-digital2-mask-${nextMaskId++}`;
        const mask = createMask(index, digits, maskId, invertFilterId);
        defs.append(mask);
        return mask;
      });
      glyphs.forEach((glyph, index) => {
        glyph.setAttribute("mask", `url(#${masks[index].getAttribute("id")})`);
        glyph.dataset.webskinClockDigit = digits[index];
      });
      element.dateTime = now.toISOString();
      element.dataset.webskinClockValue = `${digits[0]}${digits[1]}:${digits[2]}${digits[3]}`;
    };

    for (let index = 0; index < GLYPH_POSITIONS.length; index += 1) {
      const glyph = svgElement("rect", {
        x: 0,
        y: VIEWBOX_Y,
        width: VIEWBOX_WIDTH,
        height: VIEWBOX_HEIGHT,
      });
      glyph.dataset.webskinClockPart = "digit";
      glyph.dataset.webskinClockLayer = String(index);
      glyphs.push(glyph);
      glyphGroup.append(glyph);
    }

    svg.append(defs, glyphGroup);
    element.append(svg);
    if (color) element.style.setProperty("--webskin-digital2-color", color);
    if (backgroundColor) element.style.setProperty("--webskin-digital2-background", backgroundColor);

    render();
    this.addCleanup(subscribeClock(render, { updateInterval, widgetId: WIDGET_SETTINGS_ID }));
  }
}

/** Create the grayscale, asset-backed overlapping 24-hour digital clock treatment. */
export function createClock(options = {}) {
  return new DigitalPrestyled2Clock(options).element;
}
