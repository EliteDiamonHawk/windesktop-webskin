import { Widget } from "../../widgets.js";
import { subscribeClock, validateUpdateInterval } from "../time-scheduler.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const STYLE_ID = "webskin-clock-digital-prestyled2-styles";
const WIDGET_SETTINGS_ID = "digital-prestyled2";
const ASSET_ROOT = "/common/assets/fonts/google-sans-flex-numerals-svgs";
const ARTBOARD_WIDTH = 600;
const ARTBOARD_HEIGHT = 700;
const BASE_FACTOR = 0.31;
const TARGET_GLYPH_HEIGHT = 238;
const DEFAULT_MASK_OFFSET = 40;
const DEFAULT_MASK_ROUNDNESS = 100;
const MASK_FLATTEN_TOLERANCE = 0.5;
const MAX_FLATTEN_DEPTH = 12;
const DIGITS = Array.from({ length: 10 }, (_, number) => number);

const DEFAULT_LAYOUT = {
  generalScale: 1.48,
  generalPoints: [
    { x: 32, y: 18 },
    { x: 152, y: 18 },
    { x: 32, y: 242 },
    { x: 152, y: 242 },
  ],
  digitPositions: [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: -50 },
    { x: 0, y: -50 },
  ],
  rowScales: [1, 1],
  numberX: [
    [0, -5, 0, 0, 5, 0, 0, 0, 0, 0],
    [0, -10, 0, 0, 0, 10, -10, 0, 5, 0],
    [0, -5, 0, -2, 5, 0, 0, 0, 0, 0],
    [0, -10, 0, 0, 0, -10, -10, 0, 5, 0],
  ],
};

const PATH_PARAM_COUNT = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
const PATH_TOKEN_RE = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
const digitDefinitions = new Map();
const maskPathCache = new Map();
let digitAssetsPromise;
let nextWidgetId = 0;

const point = (x, y) => ({ x, y });
const clonePoint = (value) => point(value.x, value.y);
const addPoints = (a, b) => point(a.x + b.x, a.y + b.y);
const subtractPoints = (a, b) => point(a.x - b.x, a.y - b.y);
const scalePoint = (value, scalar) => point(value.x * scalar, value.y * scalar);
const lerpPoint = (a, b, amount) => point(
  a.x + ((b.x - a.x) * amount),
  a.y + ((b.y - a.y) * amount),
);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a, b) => (a.x * b.y) - (a.y * b.x);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const isPathCommand = (token) => typeof token === "string" && /^[a-zA-Z]$/.test(token);

const createSvgElement = (tag, attributes = {}) => {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
};

const parseViewBox = (viewBox) => {
  const values = String(viewBox).trim().split(/[ ,]+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    throw new TypeError("Digit SVG viewBox must contain four finite numbers");
  }
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
};

const parsePathScale = (transform = "") => {
  const match = String(transform).match(/scale\(\s*([-+\d.eE]+)(?:[ ,]+([-+\d.eE]+))?\s*\)/);
  if (!match) return 1;
  const xScale = Math.abs(Number(match[1])) || 1;
  const yScale = Math.abs(Number(match[2] ?? match[1])) || xScale;
  return (xScale + yScale) / 2;
};

const parseMaskSubpaths = (pathData) => {
  const tokens = String(pathData).match(PATH_TOKEN_RE) || [];
  const subpaths = [];
  let cursor = 0;
  let command = null;
  let current = point(0, 0);
  let subpathStart = null;
  let active = null;
  let lastCubicControl = null;
  let lastQuadraticControl = null;
  let previousCommand = "";

  const addSegment = (segment) => {
    if (active) active.segments.push(segment);
  };
  const nextPoint = (x, y, relative) => relative
    ? point(current.x + x, current.y + y)
    : point(x, y);

  while (cursor < tokens.length) {
    if (isPathCommand(tokens[cursor])) command = tokens[cursor++];
    if (!command) break;
    const upper = command.toUpperCase();
    const relative = command === command.toLowerCase();

    if (upper === "Z") {
      if (active && subpathStart) {
        if (distance(current, subpathStart) > 0.001) {
          addSegment({ type: "line", p0: clonePoint(current), p1: clonePoint(subpathStart) });
        }
        active.closed = true;
        current = clonePoint(subpathStart);
      }
      lastCubicControl = null;
      lastQuadraticControl = null;
      previousCommand = "Z";
      command = null;
      continue;
    }

    const count = PATH_PARAM_COUNT[upper];
    if (!count || cursor + count > tokens.length || isPathCommand(tokens[cursor])) {
      command = null;
      continue;
    }
    const values = tokens.slice(cursor, cursor + count).map(Number);
    cursor += count;

    if (upper === "M") {
      const next = nextPoint(values[0], values[1], relative);
      active = { start: clonePoint(next), segments: [], closed: false };
      subpaths.push(active);
      subpathStart = clonePoint(next);
      current = next;
      lastCubicControl = null;
      lastQuadraticControl = null;
      previousCommand = "M";
      command = relative ? "l" : "L";
      continue;
    }

    const p0 = clonePoint(current);
    if (upper === "L") {
      const p1 = nextPoint(values[0], values[1], relative);
      addSegment({ type: "line", p0, p1: clonePoint(p1) });
      current = p1;
      lastCubicControl = null;
      lastQuadraticControl = null;
    } else if (upper === "H") {
      const p1 = point(relative ? current.x + values[0] : values[0], current.y);
      addSegment({ type: "line", p0, p1: clonePoint(p1) });
      current = p1;
      lastCubicControl = null;
      lastQuadraticControl = null;
    } else if (upper === "V") {
      const p1 = point(current.x, relative ? current.y + values[0] : values[0]);
      addSegment({ type: "line", p0, p1: clonePoint(p1) });
      current = p1;
      lastCubicControl = null;
      lastQuadraticControl = null;
    } else if (upper === "C") {
      const c1 = nextPoint(values[0], values[1], relative);
      const c2 = nextPoint(values[2], values[3], relative);
      const p1 = nextPoint(values[4], values[5], relative);
      addSegment({ type: "cubic", p0, c1: clonePoint(c1), c2: clonePoint(c2), p1: clonePoint(p1) });
      current = p1;
      lastCubicControl = c2;
      lastQuadraticControl = null;
    } else if (upper === "S") {
      const c1 = (previousCommand === "C" || previousCommand === "S") && lastCubicControl
        ? addPoints(current, subtractPoints(current, lastCubicControl))
        : clonePoint(current);
      const c2 = nextPoint(values[0], values[1], relative);
      const p1 = nextPoint(values[2], values[3], relative);
      addSegment({ type: "cubic", p0, c1: clonePoint(c1), c2: clonePoint(c2), p1: clonePoint(p1) });
      current = p1;
      lastCubicControl = c2;
      lastQuadraticControl = null;
    } else if (upper === "Q") {
      const control = nextPoint(values[0], values[1], relative);
      const p1 = nextPoint(values[2], values[3], relative);
      addSegment({ type: "quadratic", p0, control: clonePoint(control), p1: clonePoint(p1) });
      current = p1;
      lastQuadraticControl = control;
      lastCubicControl = null;
    } else if (upper === "T") {
      const control = (previousCommand === "Q" || previousCommand === "T") && lastQuadraticControl
        ? addPoints(current, subtractPoints(current, lastQuadraticControl))
        : clonePoint(current);
      const p1 = nextPoint(values[0], values[1], relative);
      addSegment({ type: "quadratic", p0, control: clonePoint(control), p1: clonePoint(p1) });
      current = p1;
      lastQuadraticControl = control;
      lastCubicControl = null;
    } else if (upper === "A") {
      const p1 = nextPoint(values[5], values[6], relative);
      addSegment({ type: "line", p0, p1: clonePoint(p1) });
      current = p1;
      lastCubicControl = null;
      lastQuadraticControl = null;
    }
    previousCommand = upper;
  }

  return subpaths.filter((subpath) => subpath.closed && subpath.segments.length > 1);
};

const pointLineDistance = (value, lineStart, lineEnd) => {
  const line = subtractPoints(lineEnd, lineStart);
  const lengthSquared = (line.x * line.x) + (line.y * line.y);
  if (lengthSquared < 0.000001) return distance(value, lineStart);
  return Math.abs(cross(subtractPoints(value, lineStart), line)) / Math.sqrt(lengthSquared);
};

const flattenQuadratic = (p0, control, p1, tolerance, output, depth = 0) => {
  if (depth >= MAX_FLATTEN_DEPTH || pointLineDistance(control, p0, p1) <= tolerance) {
    output.push(clonePoint(p1));
    return;
  }
  const p01 = lerpPoint(p0, control, 0.5);
  const p12 = lerpPoint(control, p1, 0.5);
  const midpoint = lerpPoint(p01, p12, 0.5);
  flattenQuadratic(p0, p01, midpoint, tolerance, output, depth + 1);
  flattenQuadratic(midpoint, p12, p1, tolerance, output, depth + 1);
};

const flattenCubic = (p0, c1, c2, p1, tolerance, output, depth = 0) => {
  const controlsAreFlat = pointLineDistance(c1, p0, p1) <= tolerance
    && pointLineDistance(c2, p0, p1) <= tolerance;
  if (depth >= MAX_FLATTEN_DEPTH || controlsAreFlat) {
    output.push(clonePoint(p1));
    return;
  }
  const p01 = lerpPoint(p0, c1, 0.5);
  const p12 = lerpPoint(c1, c2, 0.5);
  const p23 = lerpPoint(c2, p1, 0.5);
  const p012 = lerpPoint(p01, p12, 0.5);
  const p123 = lerpPoint(p12, p23, 0.5);
  const midpoint = lerpPoint(p012, p123, 0.5);
  flattenCubic(p0, p01, p012, midpoint, tolerance, output, depth + 1);
  flattenCubic(midpoint, p123, p23, p1, tolerance, output, depth + 1);
};

const flattenMaskSubpath = (subpath) => {
  const points = [clonePoint(subpath.start)];
  subpath.segments.forEach((segment) => {
    if (segment.type === "line") points.push(clonePoint(segment.p1));
    if (segment.type === "quadratic") {
      flattenQuadratic(segment.p0, segment.control, segment.p1, MASK_FLATTEN_TOLERANCE, points);
    }
    if (segment.type === "cubic") {
      flattenCubic(segment.p0, segment.c1, segment.c2, segment.p1, MASK_FLATTEN_TOLERANCE, points);
    }
  });
  if (points.length > 1 && distance(points[0], points[points.length - 1]) < 0.001) points.pop();
  return points.filter((value, index) => index === 0 || distance(value, points[index - 1]) > 0.01);
};

const polygonArea = (points) => {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    area += (points[index].x * next.y) - (next.x * points[index].y);
  }
  return area / 2;
};

const unitVector = (value) => {
  const length = Math.hypot(value.x, value.y);
  return length < 0.000001 ? point(0, 0) : scalePoint(value, 1 / length);
};

const lineIntersection = (a, directionA, b, directionB) => {
  const denominator = cross(directionA, directionB);
  if (Math.abs(denominator) < 0.000001) return null;
  const amount = cross(subtractPoints(b, a), directionB) / denominator;
  return addPoints(a, scalePoint(directionA, amount));
};

const formatPoint = (value) => `${value.x.toFixed(3)} ${value.y.toFixed(3)}`;

const offsetMaskPolygon = (points, offset, roundness) => {
  if (points.length < 3 || offset <= 0) return "";
  const orientation = polygonArea(points) >= 0 ? 1 : -1;
  const edgeDirections = points.map((value, index) => unitVector(
    subtractPoints(points[(index + 1) % points.length], value),
  ));
  const edgeNormals = edgeDirections.map((direction) => scalePoint(
    point(direction.y, -direction.x),
    orientation,
  ));
  const roundFactor = clamp(Number(roundness) / 100, 0, 1);
  const first = points[0];
  const previousIndex = points.length - 1;
  const firstIncoming = addPoints(first, scalePoint(edgeNormals[previousIndex], offset));
  let output = `M ${formatPoint(firstIncoming)} `;

  points.forEach((current, index) => {
    const previous = (index + points.length - 1) % points.length;
    const incoming = addPoints(current, scalePoint(edgeNormals[previous], offset));
    const outgoing = addPoints(current, scalePoint(edgeNormals[index], offset));
    if (index > 0) output += `L ${formatPoint(incoming)} `;
    const turn = cross(edgeDirections[previous], edgeDirections[index]) * orientation;
    const miter = lineIntersection(incoming, edgeDirections[previous], outgoing, edgeDirections[index]);
    const safeMiter = miter && distance(miter, current) <= offset * 14
      ? miter
      : lerpPoint(incoming, outgoing, 0.5);
    if (turn > 0.0005 && roundFactor > 0.001) {
      if (roundFactor >= 0.999) {
        const sweep = orientation > 0 ? 1 : 0;
        output += `A ${offset.toFixed(3)} ${offset.toFixed(3)} 0 0 ${sweep} ${formatPoint(outgoing)} `;
      } else {
        const control = lerpPoint(safeMiter, current, roundFactor);
        output += `Q ${formatPoint(control)} ${formatPoint(outgoing)} `;
      }
    } else {
      output += `L ${formatPoint(safeMiter)} L ${formatPoint(outgoing)} `;
    }
  });
  return `${output}Z`;
};

const buildMaskPath = (number, offset, roundness) => {
  const definition = digitDefinitions.get(number);
  if (!definition?.path) return "";
  const numericOffset = Math.max(0, Number(offset) || 0);
  const numericRoundness = clamp(Number(roundness) || 0, 0, 100);
  if (numericOffset <= 0) return definition.path;
  const key = `${number}|${numericOffset}|${numericRoundness}`;
  if (maskPathCache.has(key)) return maskPathCache.get(key);
  const subpaths = parseMaskSubpaths(definition.path);
  const result = subpaths
    .map((subpath) => offsetMaskPolygon(
      flattenMaskSubpath(subpath),
      numericOffset,
      numericRoundness,
    ))
    .filter(Boolean)
    .join(" ");
  const value = result || definition.path;
  maskPathCache.set(key, value);
  return value;
};

const assetUrl = (number) => `${ASSET_ROOT}/${number}.svg`;

const loadDigitAssets = async () => {
  const fetchFunction = typeof window !== "undefined" && typeof window.fetch === "function"
    ? window.fetch.bind(window)
    : typeof fetch === "function" ? fetch : null;
  if (!fetchFunction || typeof DOMParser === "undefined") return;

  await Promise.all(DIGITS.map(async (number) => {
    const response = await fetchFunction(assetUrl(number));
    if (response.ok === false) throw new Error(`Unable to load ${number}.svg`);
    const source = await response.text();
    const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
    const svg = parsed.documentElement;
    const path = svg.querySelector("path");
    const viewBox = svg.getAttribute("viewBox");
    if (!path || !viewBox) throw new Error(`Invalid SVG asset for ${number}`);
    digitDefinitions.set(number, {
      number,
      path: path.getAttribute("d"),
      transform: path.getAttribute("transform") || "",
      pathScale: parsePathScale(path.getAttribute("transform") || ""),
      viewBox,
      box: parseViewBox(viewBox),
    });
  }));
};

const ensureDigitAssets = () => {
  if (!digitAssetsPromise) digitAssetsPromise = loadDigitAssets();
  return digitAssetsPromise;
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
      background: var(--webskin-digital2-background);
      box-sizing: border-box;
      color: var(--webskin-digital2-color);
      display: inline-block;
      height: var(--webskin-clock-height, 11.5rem);
      min-height: 0;
      min-width: 0;
      overflow: visible;
      width: var(--webskin-clock-width, 10rem);
    }
    .webskin-clock--digital-prestyled2 > svg {
      display: block;
      height: 100%;
      overflow: visible;
      width: 100%;
    }
    .webskin-clock--digital-prestyled2 [data-webskin-clock-part="digit"] {
      pointer-events: none;
    }
    .webskin-clock--digital-prestyled2.is-blur {
      backdrop-filter: blur(8px) saturate(.72);
      -webkit-backdrop-filter: blur(8px) saturate(.72);
    }
    .webskin-clock--digital-prestyled2.is-blur [data-webskin-clock-part="digit"] {
      filter: blur(1.1px);
      fill-opacity: .7;
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

const normalizedScale = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const digitsFor = (now, format) => {
  const hour24 = now.getHours();
  const hour = format === "24h" ? hour24 : (hour24 % 12 || 12);
  const value = `${String(hour).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  return [...value].map(Number);
};

const rowIndexForPosition = (position) => position < 2 ? 0 : 1;

const createFallbackDigit = (number, definition, position, kind) => {
  const image = createSvgElement("image", {
    x: definition?.box.x ?? 0,
    y: definition?.box.y ?? 0,
    width: definition?.box.width ?? 1000,
    height: definition?.box.height ?? 1000,
    href: assetUrl(number),
    "data-webskin-clock-part": kind === "mask" ? "mask" : "digit",
    "data-webskin-clock-layer": position,
    preserveAspectRatio: "none",
  });
  image.setAttribute("xlink:href", assetUrl(number));
  return image;
};

const makeDigitSvg = ({ number, position, x, y, width, height }) => {
  const definition = digitDefinitions.get(number);
  const viewBox = definition?.viewBox || "0 0 1000 1000";
  const svg = createSvgElement("svg", {
    x,
    y,
    width,
    height,
    viewBox,
    preserveAspectRatio: "none",
    overflow: "visible",
    "aria-hidden": "true",
    "data-webskin-clock-layer": position,
    "data-webskin-clock-digit": number,
  });
  svg.classList.add("webskin-clock__digit");

  if (!definition?.path) {
    svg.append(createFallbackDigit(number, definition, position, "digit"));
    return svg;
  }

  const path = createSvgElement("path", {
    d: definition.path,
    fill: position === 0 || position === 3
      ? "var(--webskin-digital2-accent)"
      : "var(--webskin-digital2-color)",
    "fill-rule": "nonzero",
    "data-webskin-clock-part": "digit",
    "data-webskin-clock-layer": position,
  });
  if (definition.transform) path.setAttribute("transform", definition.transform);
  svg.append(path);
  return svg;
};

const makeMaskShape = ({ number, position, x, y, width, height, maskOffset, maskRoundness }) => {
  const definition = digitDefinitions.get(number);
  if (!definition?.path) return null;
  const localOffset = maskOffset / (definition.pathScale || 1);
  const svg = createSvgElement("svg", {
    x,
    y,
    width,
    height,
    viewBox: definition.viewBox,
    preserveAspectRatio: "none",
    overflow: "visible",
    "aria-hidden": "true",
    "data-webskin-clock-layer": `mask-${position}`,
    "data-webskin-clock-digit": number,
  });
  const path = createSvgElement("path", {
    d: definition.path,
    fill: "black",
    "fill-rule": "evenodd",
    "clip-rule": "evenodd",
    stroke: "black",
    "stroke-width": localOffset * 2,
    "stroke-linejoin": maskRoundness > 0 ? "round" : "miter",
    "stroke-linecap": maskRoundness > 0 ? "round" : "butt",
    "data-webskin-clock-part": "mask",
    "data-webskin-clock-layer": position,
  });
  if (definition.transform) path.setAttribute("transform", definition.transform);
  svg.append(path);
  return svg;
};

const createKnockoutMask = ({ ownerId, position, geometries, maskOffset, maskRoundness }) => {
  const maskId = `${ownerId}-mask-${position}`;
  const mask = createSvgElement("mask", {
    id: maskId,
    x: 0,
    y: 0,
    width: ARTBOARD_WIDTH,
    height: ARTBOARD_HEIGHT,
    maskUnits: "userSpaceOnUse",
    maskContentUnits: "userSpaceOnUse",
    "mask-type": "luminance",
    style: "mask-type: luminance",
    "data-webskin-clock-owner": ownerId,
    "data-webskin-clock-part": "mask",
    "data-webskin-clock-layer": `mask-${position}`,
  });
  mask.append(createSvgElement("rect", {
    x: 0,
    y: 0,
    width: ARTBOARD_WIDTH,
    height: ARTBOARD_HEIGHT,
    fill: "white",
  }));
  for (let higherPosition = position + 1; higherPosition < geometries.length; higherPosition += 1) {
    const shape = makeMaskShape({
      ...geometries[higherPosition],
      maskOffset,
      maskRoundness,
    });
    if (shape) mask.append(shape);
  }
  return { id: maskId, element: mask };
};

const rowScaleAt = (layout, position) => layout.rowScales[rowIndexForPosition(position)] ?? 1;

const createWidgetOwnerId = () => {
  const randomId = globalThis.crypto?.randomUUID?.();
  return `webskin-digital2-${randomId || `${Date.now()}-${nextWidgetId++}`}`;
};

const layoutFrom = (value) => {
  if (!value || typeof value !== "object") return DEFAULT_LAYOUT;
  return {
    generalScale: normalizedScale(value.generalScale, DEFAULT_LAYOUT.generalScale),
    generalPoints: Array.from({ length: 4 }, (_, position) => ({
      x: Number.isFinite(Number(value.generalPoints?.[position]?.x))
        ? Number(value.generalPoints[position].x) : DEFAULT_LAYOUT.generalPoints[position].x,
      y: Number.isFinite(Number(value.generalPoints?.[position]?.y))
        ? Number(value.generalPoints[position].y) : DEFAULT_LAYOUT.generalPoints[position].y,
    })),
    digitPositions: Array.from({ length: 4 }, (_, position) => ({
      x: Number.isFinite(Number(value.digitPositions?.[position]?.x))
        ? Number(value.digitPositions[position].x) : DEFAULT_LAYOUT.digitPositions[position].x,
      y: Number.isFinite(Number(value.digitPositions?.[position]?.y))
        ? Number(value.digitPositions[position].y) : DEFAULT_LAYOUT.digitPositions[position].y,
    })),
    rowScales: [0, 1].map((row) => normalizedScale(value.rowScales?.[row]?.scale, DEFAULT_LAYOUT.rowScales[row])),
    numberX: DEFAULT_LAYOUT.numberX,
  };
};

class DigitalPrestyled2Clock extends Widget {
  constructor(options = {}) {
    ensureStyles();
    const {
      format = "24h",
      offsetMinutes = 0,
      updateInterval,
      className = "",
      color,
      accentColor,
      backgroundColor,
      blur = false,
      maskOffset = DEFAULT_MASK_OFFSET,
      maskRoundness = DEFAULT_MASK_ROUNDNESS,
      layout: layoutOption,
    } = options;
    validateUpdateInterval(updateInterval);

    const layout = layoutFrom(layoutOption);
    const ownerId = createWidgetOwnerId();
    const normalizedFormat = format === "24h" ? "24h" : "12h";
    const numericOffset = Number(offsetMinutes) || 0;
    const numericMaskOffset = Math.max(0, Number(maskOffset) || 0);
    const numericMaskRoundness = clamp(Number(maskRoundness) || 0, 0, 100);
    const element = document.createElement("time");
    super(element, { type: "clock" });
    element.className = [
      "webskin-clock",
      "webskin-clock--digital-prestyled2",
      blur ? "is-blur" : "",
      className,
    ].filter(Boolean).join(" ");
    element.setAttribute("aria-label", "Current time");
    if (color) element.style.setProperty("--webskin-digital2-color", color);
    if (accentColor) element.style.setProperty("--webskin-digital2-accent", accentColor);
    if (backgroundColor) element.style.setProperty("--webskin-digital2-background", backgroundColor);

    const svg = createSvgElement("svg", {
      viewBox: `0 0 ${ARTBOARD_WIDTH} ${ARTBOARD_HEIGHT}`,
      role: "img",
      "aria-hidden": "true",
      preserveAspectRatio: "xMidYMin meet",
    });
    element.append(svg);

    let active = true;
    let lastSnapshot = new Date();
    const render = (snapshot = new Date()) => {
      if (!active) return;
      const shifted = new Date(snapshot.getTime() + (numericOffset * 60_000));
      const digits = digitsFor(shifted, normalizedFormat);
      const layers = createSvgElement("g", {
        transform: `scale(${layout.generalScale})`,
        "data-webskin-clock-part": "layers",
        "data-webskin-clock-owner": ownerId,
      });
      const geometries = digits.map((number, position) => {
        const pointValue = layout.generalPoints[position];
        const digitOffset = layout.digitPositions[position];
        const numberX = pointValue.x + digitOffset.x + layout.numberX[position][number];
        const numberY = pointValue.y + digitOffset.y;
        const definition = digitDefinitions.get(number);
        const baseScale = definition
          ? TARGET_GLYPH_HEIGHT / (definition.box.height * BASE_FACTOR)
          : TARGET_GLYPH_HEIGHT / (1000 * BASE_FACTOR);
        const effectiveScale = baseScale * rowScaleAt(layout, position);
        return {
          number,
          position,
          x: numberX,
          y: numberY,
          width: (definition?.box.width ?? 1000) * BASE_FACTOR * effectiveScale,
          height: (definition?.box.height ?? 1000) * BASE_FACTOR * effectiveScale,
        };
      });
      const masks = geometries.map((_, position) => createKnockoutMask({
        ownerId,
        position,
        geometries,
        maskOffset: numericMaskOffset,
        maskRoundness: numericMaskRoundness,
      }));
      const defs = createSvgElement("defs");
      masks.forEach(({ element }) => defs.append(element));
      layers.append(defs);
      geometries.forEach((geometry, position) => {
        const layer = createSvgElement("g", {
          mask: `url(#${masks[position].id})`,
          "data-webskin-clock-part": "digit-layer",
          "data-webskin-clock-layer": position,
          "data-webskin-clock-digit": geometry.number,
          "data-webskin-clock-owner": ownerId,
        });
        layer.append(makeDigitSvg(geometry));
        layers.append(layer);
      });
      svg.replaceChildren(layers);
      element.dateTime = shifted.toISOString();
      element.dataset.webskinClockValue = `${digits[0]}${digits[1]}:${digits[2]}${digits[3]}`;
      lastSnapshot = snapshot;
    };

    render();
    void ensureDigitAssets().then(() => render(lastSnapshot)).catch(() => render(lastSnapshot));
    this.addCleanup(() => { active = false; });
    this.addCleanup(subscribeClock(render, { updateInterval, widgetId: WIDGET_SETTINGS_ID }));
  }
}

export function createClock(options = {}) {
  return new DigitalPrestyled2Clock(options).element;
}
