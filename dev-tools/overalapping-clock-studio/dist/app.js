const SVG_NS = "http://www.w3.org/2000/svg";
const DIGITS = Array.from({ length: 10 }, (_, number) => number);
const POSITION_NAMES = ["A", "B", "C", "D"];
const POSITION_COLORS = ["#4d8d73", "#7c6c9b", "#b86459", "#6f97b6"];
const REFERENCE_NUMBERS = [0, 4, 0, 1];
const BASE_FACTOR = 0.31;
const DEFAULT_MASK_OFFSET = 22;
const DEFAULT_MASK_ROUNDNESS = 100;
const MASK_FLATTEN_TOLERANCE = 0.5;
const TARGET_GLYPH_HEIGHT = 238;
const SOURCE_VIEWBOX_HEIGHTS = Array.from({ length: 10 }, () => 1000);
const DEFAULT_NUMBER_SCALES = SOURCE_VIEWBOX_HEIGHTS.map((height) => Number((TARGET_GLYPH_HEIGHT / (height * BASE_FACTOR)).toFixed(6)));
const DEFAULT_NUMBER_X = Array.from({ length: 10 }, () => 0);
const ROWS = [
  { id: "AB", positions: [0, 1] },
  { id: "CD", positions: [2, 3] },
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  layers: $("#layers"),
  points: $("#points"),
  generalControls: $("#generalControls"),
  digitControls: $("#digitControls"),
  positionCards: $("#positionCards"),
  variantMatrix: $("#variantMatrix"),
  variantEditor: $("#variantEditor"),
  activeVariantLabel: $("#activeVariantLabel"),
  overallScale: $("#overallScale"),
  overallScaleValue: $("#overallScaleValue"),
  exportSummary: $("#exportSummary"),
  numericCount: $("#numericCount"),
  savedCount: $("#savedCount"),
  statusText: $("#statusText"),
  stageCoordinate: $("#stageCoordinate"),
  maskLegend: $("#maskLegend"),
  toast: $("#toast"),
  artboard: $("#artboard"),
};

const digitDefs = new Map();
const maskPathCache = new Map();
let toastTimer;

function makeDefaultState() {
  const generalPoints = [
    { x: 32, y: 18 },
    { x: 226, y: 18 },
    { x: 32, y: 242 },
    { x: 226, y: 242 },
  ];
  const digitPositions = [
    { x: 0, y: 0 },
    { x: -2, y: 0 },
    { x: 0, y: 0 },
    { x: -3, y: 0 },
  ];
  const numberVariants = [];
  const maskVariants = [];
  const maskSettings = { offset: DEFAULT_MASK_OFFSET, roundness: DEFAULT_MASK_ROUNDNESS };
  for (let position = 0; position < 4; position += 1) {
    for (const number of DIGITS) {
      const visible = REFERENCE_NUMBERS[position] === number;
      const x = DEFAULT_NUMBER_X[number];
      const scale = DEFAULT_NUMBER_SCALES[number];
      numberVariants.push({ position, number, x, y: 0, scale, saved: visible });
      maskVariants.push({ position, number, offset: maskSettings.offset, roundness: maskSettings.roundness });
    }
  }
  return {
    generalPoints,
    digitPositions,
    rowScales: [1, 1],
    maskSettings,
    numberVariants,
    maskVariants,
    visibleNumbers: [...REFERENCE_NUMBERS],
    overallScale: 1,
    activeVariant: { position: 0, number: REFERENCE_NUMBERS[0] },
  };
}

let state = makeDefaultState();

function syncMaskVariants(targetState = state) {
  targetState.maskVariants.forEach((record) => {
    record.offset = targetState.maskSettings.offset;
    record.roundness = targetState.maskSettings.roundness;
  });
}

function getVariant(collection, position, number) {
  return collection.find((item) => item.position === position && item.number === number);
}

function rowIndexForPosition(position) {
  return position < 2 ? 0 : 1;
}

function rowY(rowIndex) {
  return state.digitPositions[ROWS[rowIndex].positions[0]].y;
}

function syncDigitRowY(rowIndex, value) {
  ROWS[rowIndex].positions.forEach((position) => {
    state.digitPositions[position].y = value;
    state.numberVariants.filter((record) => record.position === position).forEach((record) => { record.y = 0; });
  });
}

function syncGeneralRowY(rowIndex, value) {
  ROWS[rowIndex].positions.forEach((position) => { state.generalPoints[position].y = value; });
}

function parseViewBox(viewBox) {
  const values = viewBox.trim().split(/[ ,]+/).map(Number);
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

function parsePathScale(transform = "") {
  const match = transform.match(/scale\(\s*([-+\d.eE]+)(?:[ ,]+([-+\d.eE]+))?\s*\)/);
  if (!match) return 1;
  const xScale = Math.abs(Number(match[1])) || 1;
  const yScale = Math.abs(Number(match[2] ?? match[1])) || xScale;
  return (xScale + yScale) / 2;
}

const PATH_PARAM_COUNT = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
const PATH_TOKEN_RE = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

function point(x, y) { return { x, y }; }
function clonePoint(value) { return { x: value.x, y: value.y }; }
function addPoints(a, b) { return point(a.x + b.x, a.y + b.y); }
function subPoints(a, b) { return point(a.x - b.x, a.y - b.y); }
function scalePoint(value, scalar) { return point(value.x * scalar, value.y * scalar); }
function lerpPoint(a, b, t) { return point(a.x + ((b.x - a.x) * t), a.y + ((b.y - a.y) * t)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function cross(a, b) { return (a.x * b.y) - (a.y * b.x); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function isPathCommand(token) { return typeof token === "string" && /^[a-zA-Z]$/.test(token); }

function parseMaskSubpaths(pathData) {
  const tokens = pathData.match(PATH_TOKEN_RE) || [];
  const subpaths = [];
  let cursor = 0;
  let command = null;
  let current = point(0, 0);
  let subpathStart = null;
  let active = null;
  let lastCubicControl = null;
  let lastQuadraticControl = null;
  let previousCommand = "";

  const addSegment = (segment) => { if (active) active.segments.push(segment); };
  const nextPoint = (x, y, relative) => relative ? point(current.x + x, current.y + y) : point(x, y);

  while (cursor < tokens.length) {
    if (isPathCommand(tokens[cursor])) command = tokens[cursor++];
    if (!command) break;
    const upper = command.toUpperCase();
    const relative = command === command.toLowerCase();
    if (upper === "Z") {
      if (active && subpathStart) {
        if (distance(current, subpathStart) > 0.001) addSegment({ type: "line", p0: clonePoint(current), p1: clonePoint(subpathStart) });
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
        ? addPoints(current, subPoints(current, lastCubicControl))
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
        ? addPoints(current, subPoints(current, lastQuadraticControl))
        : clonePoint(current);
      const p1 = nextPoint(values[0], values[1], relative);
      addSegment({ type: "quadratic", p0, control: clonePoint(control), p1: clonePoint(p1) });
      current = p1;
      lastQuadraticControl = control;
      lastCubicControl = null;
    } else if (upper === "A") {
      // The supplied Google Sans Flex assets do not use arcs. Treat an unforeseen
      // arc as its endpoint line so the mask generator remains fail-safe.
      const p1 = nextPoint(values[5], values[6], relative);
      addSegment({ type: "line", p0, p1: clonePoint(p1) });
      current = p1;
      lastCubicControl = null;
      lastQuadraticControl = null;
    }
    previousCommand = upper;
  }
  return subpaths.filter((subpath) => subpath.closed && subpath.segments.length > 1);
}

function pointLineDistance(pointValue, lineStart, lineEnd) {
  const line = subPoints(lineEnd, lineStart);
  const lengthSquared = (line.x * line.x) + (line.y * line.y);
  if (lengthSquared < 0.000001) return distance(pointValue, lineStart);
  return Math.abs(cross(subPoints(pointValue, lineStart), line)) / Math.sqrt(lengthSquared);
}

function flattenQuadratic(p0, control, p1, tolerance, output, depth = 0) {
  if (depth >= 10 || pointLineDistance(control, p0, p1) <= tolerance) {
    output.push(clonePoint(p1));
    return;
  }
  const p01 = lerpPoint(p0, control, 0.5);
  const p12 = lerpPoint(control, p1, 0.5);
  const mid = lerpPoint(p01, p12, 0.5);
  flattenQuadratic(p0, p01, mid, tolerance, output, depth + 1);
  flattenQuadratic(mid, p12, p1, tolerance, output, depth + 1);
}

function flattenCubic(p0, c1, c2, p1, tolerance, output, depth = 0) {
  if (depth >= 10 && (pointLineDistance(c1, p0, p1) <= tolerance * 3) && (pointLineDistance(c2, p0, p1) <= tolerance * 3)) {
    output.push(clonePoint(p1));
    return;
  }
  if (depth < 10 && pointLineDistance(c1, p0, p1) <= tolerance && pointLineDistance(c2, p0, p1) <= tolerance) {
    output.push(clonePoint(p1));
    return;
  }
  const p01 = lerpPoint(p0, c1, 0.5);
  const p12 = lerpPoint(c1, c2, 0.5);
  const p23 = lerpPoint(c2, p1, 0.5);
  const p012 = lerpPoint(p01, p12, 0.5);
  const p123 = lerpPoint(p12, p23, 0.5);
  const mid = lerpPoint(p012, p123, 0.5);
  flattenCubic(p0, p01, p012, mid, tolerance, output, depth + 1);
  flattenCubic(mid, p123, p23, p1, tolerance, output, depth + 1);
}

function flattenMaskSubpath(subpath) {
  const points = [clonePoint(subpath.start)];
  subpath.segments.forEach((segment) => {
    if (segment.type === "line") points.push(clonePoint(segment.p1));
    if (segment.type === "quadratic") flattenQuadratic(segment.p0, segment.control, segment.p1, MASK_FLATTEN_TOLERANCE, points);
    if (segment.type === "cubic") flattenCubic(segment.p0, segment.c1, segment.c2, segment.p1, MASK_FLATTEN_TOLERANCE, points);
  });
  if (points.length > 1 && distance(points[0], points[points.length - 1]) < 0.001) points.pop();
  return points.filter((value, index) => index === 0 || distance(value, points[index - 1]) > 0.01);
}

function polygonArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    area += (points[index].x * next.y) - (next.x * points[index].y);
  }
  return area / 2;
}

function unitVector(value) {
  const length = Math.hypot(value.x, value.y);
  return length < 0.000001 ? point(0, 0) : scalePoint(value, 1 / length);
}

function lineIntersection(a, directionA, b, directionB) {
  const denominator = cross(directionA, directionB);
  if (Math.abs(denominator) < 0.000001) return null;
  const t = cross(subPoints(b, a), directionB) / denominator;
  return addPoints(a, scalePoint(directionA, t));
}

function formatPoint(value) { return `${value.x.toFixed(3)} ${value.y.toFixed(3)}`; }

function offsetMaskPolygon(points, offset, roundness) {
  if (points.length < 3 || offset <= 0) return "";
  const orientation = polygonArea(points) >= 0 ? 1 : -1;
  const edgeDirections = points.map((value, index) => unitVector(subPoints(points[(index + 1) % points.length], value)));
  const edgeNormals = edgeDirections.map((direction) => scalePoint(point(direction.y, -direction.x), orientation));
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
    const safeMiter = miter && distance(miter, current) <= offset * 14 ? miter : lerpPoint(incoming, outgoing, 0.5);
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
}

function buildMaskPath(number, offset, roundness) {
  const def = digitDefs.get(number);
  if (!def || !def.path) return "";
  const numericOffset = Math.max(0, Number(offset) || 0);
  const numericRoundness = clamp(Number(roundness) || 0, 0, 100);
  if (numericOffset <= 0) return def.path;
  const key = `${number}|${numericOffset}|${numericRoundness}`;
  if (maskPathCache.has(key)) return maskPathCache.get(key);
  const subpaths = parseMaskSubpaths(def.path);
  const result = subpaths.map((subpath) => offsetMaskPolygon(flattenMaskSubpath(subpath), numericOffset, numericRoundness)).filter(Boolean).join(" ");
  maskPathCache.set(key, result);
  return result;
}

async function loadDigitAssets() {
  const requests = DIGITS.map(async (number) => {
    const response = await fetch(`./assets/digits/${number}.svg`);
    if (!response.ok) throw new Error(`Unable to load ${number}.svg`);
    const source = await response.text();
    const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
    const svg = parsed.documentElement;
    const path = svg.querySelector("path");
    const text = svg.querySelector("text");
    const viewBox = svg.getAttribute("viewBox");
    if ((!path && !text) || !viewBox) throw new Error(`Invalid SVG asset for ${number}`);
    const textAttributes = {};
    if (text) {
      ["x", "y", "text-anchor", "font-family", "font-size", "font-style", "font-weight", "font-variation-settings", "font-synthesis", "letter-spacing"].forEach((attribute) => {
        if (text.hasAttribute(attribute)) textAttributes[attribute] = text.getAttribute(attribute);
      });
    }
    digitDefs.set(number, {
      number,
      path: path?.getAttribute("d") || null,
      transform: path?.getAttribute("transform") || "",
      pathScale: parsePathScale(path?.getAttribute("transform") || ""),
      text: text?.textContent.trim() || null,
      textAttributes,
      viewBox,
      box: parseViewBox(viewBox),
    });
  });
  await Promise.all(requests);
}

function normalizeDefaultVariantHeights() {
  state.numberVariants.forEach((numberRecord) => {
    const def = digitDefs.get(numberRecord.number);
    const scale = Number((TARGET_GLYPH_HEIGHT / (def.box.height * BASE_FACTOR)).toFixed(6));
    numberRecord.scale = scale;
  });
}

function makeSvg(number, kind, maskRecord = null) {
  const def = digitDefs.get(number);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("digit-svg", kind === "mask" ? "mask-svg" : "number-svg");
  svg.setAttribute("viewBox", def.viewBox);
  svg.setAttribute("aria-hidden", "true");
  if (def.path) {
    const path = document.createElementNS(SVG_NS, "path");
    const maskOffset = Math.max(0, Number(maskRecord?.offset) || 0) / (def.pathScale || 1);
    path.setAttribute("d", kind === "mask" ? buildMaskPath(number, maskOffset, maskRecord?.roundness) : def.path);
    if (def.transform) path.setAttribute("transform", def.transform);
    path.setAttribute("fill", "currentColor");
    path.setAttribute("fill-rule", kind === "mask" ? "evenodd" : "nonzero");
    svg.appendChild(path);
  } else if (def.text) {
    const text = document.createElementNS(SVG_NS, "text");
    Object.entries(def.textAttributes).forEach(([attribute, value]) => text.setAttribute(attribute, value));
    if (def.textAttributes["font-family"]?.includes("Google Sans Flex")) text.setAttribute("font-family", "Google Sans Flex, Segoe UI, sans-serif");
    text.textContent = def.text;
    text.setAttribute("fill", "currentColor");
    if (kind === "mask") {
      // The uploaded text SVGs contain the real font glyph. A stroked text
      // outline is the renderer's exact parallel offset of that glyph.
      const offset = Math.max(0, Number(maskRecord?.offset) || 0);
      const roundness = clamp(Number(maskRecord?.roundness) || 0, 0, 100);
      text.setAttribute("stroke", "currentColor");
      text.setAttribute("stroke-width", String(offset * 2));
      text.setAttribute("stroke-linecap", "round");
      text.setAttribute("stroke-linejoin", roundness > 0 ? "round" : "miter");
      text.setAttribute("paint-order", "stroke fill");
    }
    svg.appendChild(text);
  }
  return svg;
}

function renderLayers() {
  els.layers.replaceChildren();
  const boardScale = state.overallScale;
  state.visibleNumbers.forEach((number, position) => {
    const numberRecord = getVariant(state.numberVariants, position, number);
    const maskRecord = getVariant(state.maskVariants, position, number);
    if (!numberRecord || !maskRecord) return;
    const def = digitDefs.get(number);
    const rowScale = state.rowScales[rowIndexForPosition(position)];
    const anchor = state.generalPoints[position];
    const digitOffset = state.digitPositions[position];
    const numberLayer = document.createElement("div");
    const maskLayer = document.createElement("div");
    numberLayer.className = "layer number-layer";
    maskLayer.className = "layer mask-layer";
    const numberSize = {
      width: def.box.width * BASE_FACTOR * numberRecord.scale * rowScale,
      height: def.box.height * BASE_FACTOR * numberRecord.scale * rowScale,
    };
    const numberX = anchor.x + digitOffset.x + numberRecord.x;
    const numberY = anchor.y + digitOffset.y;
    const maskX = numberX;
    const maskY = numberY;
    // Explicit low-to-high stack: A mask, A number, B mask, B number, C mask, C number, D mask, D number.
    // Each mask therefore sits below its attached digit, while D remains the highest digit position.
    Object.assign(numberLayer.style, { left: `${numberX}px`, top: `${numberY}px`, color: POSITION_COLORS[position], zIndex: String((position * 2) + 2) });
    Object.assign(maskLayer.style, { left: `${maskX}px`, top: `${maskY}px`, color: "#17211d", zIndex: String((position * 2) + 1) });
    numberLayer.dataset.position = position;
    maskLayer.dataset.position = position;
    numberLayer.appendChild(makeSvg(number, "number"));
    maskLayer.appendChild(makeSvg(number, "mask", state.maskSettings));
    const numberSvg = numberLayer.firstElementChild;
    const maskSvg = maskLayer.firstElementChild;
    numberSvg.setAttribute("width", numberSize.width);
    numberSvg.setAttribute("height", numberSize.height);
    maskSvg.setAttribute("width", numberSize.width);
    maskSvg.setAttribute("height", numberSize.height);
    if (position === state.activeVariant.position && number === state.activeVariant.number) {
      numberLayer.classList.add("is-active");
      maskLayer.classList.add("is-active");
    }
    els.layers.append(maskLayer, numberLayer);
  });
}

function renderPoints() {
  els.points.replaceChildren();
  state.generalPoints.forEach((point, index) => {
    const element = document.createElement("div");
    element.className = "point";
    element.dataset.index = index;
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
    element.innerHTML = `<span>${index + 1}</span><span class="point-label">P${index + 1}${index === 0 ? " / origin" : ""}</span>`;
    els.points.appendChild(element);
  });
  const top = Math.min(...state.generalPoints.slice(0, 2).map((point) => point.y));
  const bottom = Math.max(...state.generalPoints.slice(2).map((point) => point.y));
  const left = Math.min(state.generalPoints[0].x, state.generalPoints[2].x);
  const right = Math.max(state.generalPoints[1].x, state.generalPoints[3].x);
  $(".top-guide").style.top = `${top}px`;
  $(".bottom-guide").style.top = `${bottom}px`;
  $(".left-guide").style.left = `${left}px`;
  $(".right-guide").style.left = `${right}px`;
}

function fieldCard(label, value, attributes, full = false) {
  return `<label class="field-card${full ? " full" : ""}"><span class="field-label"><span>${label}</span><strong>${Number(value).toFixed(0)}</strong></span><input type="number" value="${value}" ${attributes} /></label>`;
}

function renderGeometryControls() {
  const origin = state.generalPoints[0];
  els.generalControls.innerHTML = [
    fieldCard("P1 · x", origin.x, `data-general-point="0" data-axis="x"`, true),
    fieldCard("P1 · y", origin.y, `data-general-point="0" data-axis="y"`, true),
    ...[1, 2, 3].flatMap((index) => {
      const point = state.generalPoints[index];
      const rowAligned = index === 1 || index === 3;
      return [
        fieldCard(`P${index + 1} · Δx`, point.x - origin.x, `data-general-relative="${index}" data-axis="x"`),
        fieldCard(`P${index + 1} · Δy`, point.y - origin.y, `data-general-relative="${index}" data-axis="y"${rowAligned ? " readonly" : ""}`),
      ];
    }),
  ].join("");

  els.digitControls.innerHTML = ROWS.map((row, rowIndex) => {
    const [first, second] = row.positions;
    return `<div class="field-card full"><span class="field-label"><span>Row ${row.id}</span><strong>shared y + scale</strong></span><div class="editor-fields four"><div class="mini-field"><label>row y</label><input type="number" step="0.5" value="${rowY(rowIndex)}" data-row-y="${rowIndex}" /></div><div class="mini-field"><label>row scale</label><input type="number" min="0.1" max="3" step="0.01" value="${state.rowScales[rowIndex]}" data-row-scale="${rowIndex}" /></div><div class="mini-field"><label>${POSITION_NAMES[first]} offset x</label><input type="number" step="0.5" value="${state.digitPositions[first].x}" data-digit-position="${first}" data-axis="x" /></div><div class="mini-field"><label>${POSITION_NAMES[second]} offset x</label><input type="number" step="0.5" value="${state.digitPositions[second].x}" data-digit-position="${second}" data-axis="x" /></div></div></div>`;
  }).join("");
  els.overallScale.value = state.overallScale;
  els.overallScaleValue.textContent = `${state.overallScale.toFixed(2)}×`;
}

function renderPositionCards() {
  els.positionCards.innerHTML = POSITION_NAMES.map((name, position) => {
    const saved = state.numberVariants.filter((record) => record.position === position && record.saved).length;
    const selected = state.visibleNumbers[position];
    return `<div class="position-card${position === state.activeVariant.position ? " is-selected" : ""}">
      <div class="position-card-top"><div class="position-name"><span class="position-chip">${name}</span><span>Digit position ${position + 1}</span></div><span class="micro-note">P${position + 1}</span></div>
      <select data-visible-position="${position}" aria-label="Visible number for position ${name}">${DIGITS.map((number) => `<option value="${number}"${selected === number ? " selected" : ""}>Number ${number}</option>`).join("")}</select>
      <div class="saved-summary"><span><strong>${saved}</strong> saved variants</span><span>active ${selected}</span></div>
    </div>`;
  }).join("");
}

function renderVariantMatrix() {
  let html = "";
  POSITION_NAMES.forEach((name, position) => {
    html += `<span class="variant-row-label">${name}</span>`;
    DIGITS.forEach((number) => {
      const record = getVariant(state.numberVariants, position, number);
      const isActive = position === state.activeVariant.position && number === state.activeVariant.number;
      const isVisible = state.visibleNumbers[position] === number;
      html += `<div class="variant-cell"><button class="variant-button${isActive ? " is-active" : ""}${isVisible ? " is-visible" : ""}" type="button" data-variant-position="${position}" data-variant-number="${number}" title="Position ${name}, number ${number}">${number}</button>${record?.saved ? '<span class="saved-dot" title="Saved"></span>' : ""}</div>`;
    });
  });
  els.variantMatrix.innerHTML = html;
}

function renderVariantEditor() {
  const { position, number } = state.activeVariant;
  const rowIndex = rowIndexForPosition(position);
  const numberRecord = getVariant(state.numberVariants, position, number);
  els.activeVariantLabel.textContent = `Position ${POSITION_NAMES[position]} · number ${number}`;
  els.variantEditor.innerHTML = `
    <div class="editor-title-row"><div><h5>Editing ${POSITION_NAMES[position]} / ${number}</h5><p>Values are relative to this digit position.</p></div><label class="check-saved"><input type="checkbox" data-saved-position="${position}" data-saved-number="${number}"${numberRecord.saved ? " checked" : ""} /> Saved</label></div>
    <div class="editor-section"><div class="editor-section-title"><span>Number SVG</span><span>row-locked y + scale</span></div><div class="editor-fields"><div class="mini-field"><label>x</label><input type="number" step="0.5" value="${numberRecord.x}" data-editor="number" data-property="x" /></div><div class="mini-field"><label>row y</label><input type="number" step="0.5" value="${rowY(rowIndex)}" data-row-y="${rowIndex}" /></div><div class="mini-field"><label>row scale</label><input type="number" min="0.1" max="3" step="0.01" value="${state.rowScales[rowIndex]}" data-row-scale="${rowIndex}" /></div></div></div>
    <div class="editor-section"><div class="editor-section-title"><span>Shared offset mask</span><span>applies to every number</span></div><div class="editor-fields"><div class="mini-field"><label>offset (SVG units)</label><input type="number" min="0" max="160" step="1" value="${state.maskSettings.offset}" data-mask-setting="offset" /></div><div class="mini-field"><label>roundness (%)</label><input type="number" min="0" max="100" step="1" value="${state.maskSettings.roundness}" data-mask-setting="roundness" /></div></div></div>`;
  els.maskLegend.textContent = `${state.maskSettings.offset}u · ${state.maskSettings.roundness}% round`;
}

function countNumericValues(value) {
  if (typeof value === "number" && Number.isFinite(value)) return 1;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countNumericValues(item), 0);
  if (value && typeof value === "object") return Object.values(value).reduce((sum, item) => sum + countNumericValues(item), 0);
  return 0;
}

function makeExportObject() {
  const origin = state.generalPoints[0];
  const payload = {
    schemaVersion: "clock1-mask-layout/2",
    units: "artboard-px",
    generalScale: state.overallScale,
    generalOrigin: { x: origin.x, y: origin.y },
    generalPoints: state.generalPoints.map((point, index) => ({ point: index + 1, x: point.x, y: point.y })),
    generalRelativePoints: state.generalPoints.map((point, index) => ({ point: index + 1, relativeTo: 1, x: point.x - origin.x, y: point.y - origin.y })),
    digitPositions: state.digitPositions.map((point, index) => ({ digitPosition: index + 1, anchorPoint: index + 1, x: point.x, y: point.y })),
    rowScales: ROWS.map((row, rowIndex) => ({ row: row.id, positions: row.positions.map((position) => POSITION_NAMES[position]), y: rowY(rowIndex), scale: state.rowScales[rowIndex] })),
    maskSettings: { offset: state.maskSettings.offset, roundness: state.maskSettings.roundness, sharedAcross: "all numbers and digit positions" },
    selectedNumbers: state.visibleNumbers.map((number, index) => ({ digitPosition: index + 1, number })),
    numberVariants: state.numberVariants.map((record) => {
      const rowIndex = rowIndexForPosition(record.position);
      return { digitPosition: record.position + 1, row: ROWS[rowIndex].id, number: record.number, x: record.x, y: rowY(rowIndex), scale: Number((record.scale * state.rowScales[rowIndex]).toFixed(6)), baseScale: record.scale, rowScale: state.rowScales[rowIndex], saved: record.saved };
    }),
    maskVariants: state.maskVariants.map((record) => {
      const rowIndex = rowIndexForPosition(record.position);
      return { digitPosition: record.position + 1, row: ROWS[rowIndex].id, number: record.number, offset: state.maskSettings.offset, roundness: state.maskSettings.roundness, shared: true };
    }),
    savedVariants: state.numberVariants.filter((record) => record.saved).map((record) => ({ digitPosition: record.position + 1, number: record.number })),
    maskConstruction: {
      source: "Google Sans Flex SVG digit asset",
      algorithm: "adaptive curve flattening + parallel normal offset + joined contour fill",
      textAssetFallback: "SVG text glyph with renderer-native parallel stroke outline",
      flattenToleranceSvgUnits: MASK_FLATTEN_TOLERANCE,
      offsetUnits: "source SVG units",
      roundnessUnits: "percent of a circular offset join",
      defaultOffset: DEFAULT_MASK_OFFSET,
      defaultRoundness: DEFAULT_MASK_ROUNDNESS,
      sharedAcrossAllNumbers: true,
    },
    digitAssets: { format: "SVG text", fontFamily: "Google Sans Flex", fontWeight: 1000, bold: true, viewBox: "0 0 1000 1000" },
    referencePreset: "clock1 / minimal 04:01 geometry",
    rendering: {
      svgUnitToArtboardPx: BASE_FACTOR,
      defaultTargetGlyphHeightPx: TARGET_GLYPH_HEIGHT,
      stackLowToHigh: ["A mask", "A", "B mask", "B", "C mask", "C", "D mask", "D"],
    },
  };
  payload.valueCount = countNumericValues(payload);
  return payload;
}

function renderExportSummary() {
  const payload = makeExportObject();
  const saved = state.numberVariants.filter((record) => record.saved).length;
  els.exportSummary.innerHTML = `<div class="summary-cell"><strong>${payload.valueCount}</strong><span>numeric values</span></div><div class="summary-cell"><strong>${payload.generalPoints.length}</strong><span>general points</span></div><div class="summary-cell"><strong>${payload.numberVariants.length}</strong><span>number records</span></div><div class="summary-cell"><strong>${payload.maskVariants.length}</strong><span>mask records</span></div><div class="summary-cell"><strong>${saved}</strong><span>saved variants</span></div><div class="summary-cell"><strong>${state.overallScale.toFixed(2)}×</strong><span>overall scale</span></div>`;
  els.numericCount.textContent = payload.valueCount;
  els.savedCount.textContent = `${saved} / ${state.numberVariants.length}`;
}

function renderStageMetadata() {
  const { position, number } = state.activeVariant;
  const nr = getVariant(state.numberVariants, position, number);
  const anchor = state.generalPoints[position];
  const offset = state.digitPositions[position];
  els.stageCoordinate.textContent = `P${position + 1} / ${number} · ${Math.round(anchor.x + offset.x + nr.x)} × ${Math.round(anchor.y + offset.y)}`;
  els.artboard.style.transform = `scale(${state.overallScale})`;
}

function renderAll() {
  renderLayers();
  renderPoints();
  renderGeometryControls();
  renderPositionCards();
  renderVariantMatrix();
  renderVariantEditor();
  renderExportSummary();
  renderStageMetadata();
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 2200);
}

function parseNumber(input) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : 0;
}

function handleChange(event) {
  const target = event.target;
  if (target.matches("[data-general-point]")) {
    const index = Number(target.dataset.generalPoint);
    if (target.dataset.axis === "y") {
      syncGeneralRowY(rowIndexForPosition(index), parseNumber(target));
    } else {
      state.generalPoints[index][target.dataset.axis] = parseNumber(target);
    }
    setStatus("Geometry updated");
    renderAll();
    return;
  }
  if (target.matches("[data-general-relative]")) {
    const index = Number(target.dataset.generalRelative);
    const origin = state.generalPoints[0];
    if (target.dataset.axis === "y" && (index === 1 || index === 3)) return;
    if (target.dataset.axis === "y") {
      syncGeneralRowY(rowIndexForPosition(index), origin.y + parseNumber(target));
    } else {
      state.generalPoints[index][target.dataset.axis] = origin[target.dataset.axis] + parseNumber(target);
    }
    setStatus("Relative point updated");
    renderAll();
    return;
  }
  if (target.matches("[data-row-y]")) {
    syncDigitRowY(Number(target.dataset.rowY), parseNumber(target));
    setStatus("Row y updated");
    renderAll();
    return;
  }
  if (target.matches("[data-row-scale]")) {
    state.rowScales[Number(target.dataset.rowScale)] = parseNumber(target);
    setStatus("Row scale updated");
    renderAll();
    return;
  }
  if (target.matches("[data-digit-position]")) {
    state.digitPositions[Number(target.dataset.digitPosition)][target.dataset.axis] = parseNumber(target);
    setStatus("Digit offset updated");
    renderAll();
    return;
  }
  if (target.matches("[data-visible-position]")) {
    const position = Number(target.dataset.visiblePosition);
    state.visibleNumbers[position] = Number(target.value);
    state.activeVariant = { position, number: Number(target.value) };
    setStatus(`Position ${POSITION_NAMES[position]} now shows ${target.value}`);
    renderAll();
    return;
  }
  if (target.matches("[data-mask-setting]")) {
    state.maskSettings[target.dataset.maskSetting] = parseNumber(target);
    syncMaskVariants();
    setStatus("Shared mask updated for all numbers");
    renderAll();
    return;
  }
  if (target.matches("[data-editor]")) {
    if (target.dataset.editor === "mask") {
      state.maskSettings[target.dataset.property] = parseNumber(target);
      syncMaskVariants();
      setStatus("Shared mask updated for all numbers");
      renderAll();
      return;
    }
    const collection = target.dataset.editor === "mask" ? state.maskVariants : state.numberVariants;
    const record = getVariant(collection, state.activeVariant.position, state.activeVariant.number);
    record[target.dataset.property] = parseNumber(target);
    setStatus("Variant updated");
    renderAll();
    return;
  }
  if (target.matches("[data-saved-position]")) {
    const record = getVariant(state.numberVariants, Number(target.dataset.savedPosition), Number(target.dataset.savedNumber));
    record.saved = target.checked;
    setStatus(record.saved ? "Variant marked saved" : "Variant removed from saved");
    renderAll();
  }
}

function resetState() {
  state = makeDefaultState();
  setStatus("Layout reset");
  renderAll();
  showToast("Reset to the starter composition");
}

function setActiveVariant(position, number) {
  state.activeVariant = { position, number };
  renderAll();
}

function normalizeImportedState(payload) {
  const next = makeDefaultState();
  if (Array.isArray(payload.generalPoints) && payload.generalPoints.length >= 4) {
    next.generalPoints = payload.generalPoints.slice(0, 4).map((point, index) => {
      const x = Number(point.x);
      const y = Number(point.y);
      return { x: Number.isFinite(x) ? x : next.generalPoints[index].x, y: Number.isFinite(y) ? y : next.generalPoints[index].y };
    });
  }
  ROWS.forEach((row) => {
    const sharedY = next.generalPoints[row.positions[0]].y;
    row.positions.forEach((position) => { next.generalPoints[position].y = sharedY; });
  });
  if (Array.isArray(payload.digitPositions)) {
    payload.digitPositions.slice(0, 4).forEach((record, index) => {
      const x = Number(record.x);
      const y = Number(record.y);
      next.digitPositions[index] = { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
    });
  }
  if (Array.isArray(payload.rowScales)) {
    payload.rowScales.forEach((record, index) => {
      const rowIndex = record.row === "CD" ? 1 : Number.isInteger(Number(record.row)) ? Number(record.row) : index;
      if (rowIndex < 0 || rowIndex > 1) return;
      if (Number.isFinite(Number(record.scale))) next.rowScales[rowIndex] = Number(record.scale);
      if (Number.isFinite(Number(record.y))) ROWS[rowIndex].positions.forEach((position) => { next.digitPositions[position].y = Number(record.y); });
    });
  }
  ROWS.forEach((row) => {
    const sharedY = next.digitPositions[row.positions[0]].y;
    row.positions.forEach((position) => { next.digitPositions[position].y = sharedY; });
  });
  if (Array.isArray(payload.numberVariants)) {
    payload.numberVariants.forEach((record) => {
      const position = Number(record.digitPosition ?? record.position) - (record.position === undefined ? 1 : 0);
      const number = Number(record.number);
      const target = getVariant(next.numberVariants, position, number);
      if (!target) return;
      if (Number.isFinite(Number(record.x))) target.x = Number(record.x);
      if (Number.isFinite(Number(record.baseScale))) target.scale = Number(record.baseScale);
      else if (Number.isFinite(Number(record.scale))) target.scale = Number(record.scale) / (Number.isFinite(Number(record.rowScale)) ? Number(record.rowScale) : next.rowScales[rowIndexForPosition(position)]);
      target.y = 0;
      if (typeof record.saved === "boolean") target.saved = record.saved;
    });
  }
  let importedMaskOffset = false;
  let importedMaskRoundness = false;
  if (payload.maskSettings && typeof payload.maskSettings === "object") {
    if (Number.isFinite(Number(payload.maskSettings.offset))) {
      next.maskSettings.offset = Math.max(0, Number(payload.maskSettings.offset));
      importedMaskOffset = true;
    }
    if (Number.isFinite(Number(payload.maskSettings.roundness))) {
      next.maskSettings.roundness = clamp(Number(payload.maskSettings.roundness), 0, 100);
      importedMaskRoundness = true;
    }
  }
  if (Array.isArray(payload.maskVariants)) {
    payload.maskVariants.forEach((record) => {
      if (!importedMaskOffset && Number.isFinite(Number(record.offset))) {
        next.maskSettings.offset = Math.max(0, Number(record.offset));
        importedMaskOffset = true;
      } else if (!importedMaskOffset && Number.isFinite(Number(record.roundness)) && !Number.isFinite(Number(record.offset))) {
        // Legacy exports used the old stroke-width field as the mask size.
        next.maskSettings.offset = Math.max(0, Number(record.roundness));
        importedMaskOffset = true;
      }
      if (!importedMaskRoundness && Number.isFinite(Number(record.offset)) && Number.isFinite(Number(record.roundness))) {
        next.maskSettings.roundness = clamp(Number(record.roundness), 0, 100);
        importedMaskRoundness = true;
      }
    });
  }
  syncMaskVariants(next);
  if (Array.isArray(payload.selectedNumbers)) {
    payload.selectedNumbers.slice(0, 4).forEach((record, index) => {
      const number = Number(record.number);
      next.visibleNumbers[index] = Number.isFinite(number) ? number : 0;
    });
  } else if (Array.isArray(payload.visibleNumbers)) {
    next.visibleNumbers = payload.visibleNumbers.slice(0, 4).map((number) => Number.isFinite(Number(number)) ? Number(number) : 0);
  }
  if (Number.isFinite(Number(payload.generalScale))) next.overallScale = Number(payload.generalScale);
  next.activeVariant = { position: 0, number: next.visibleNumbers[0] };
  return next;
}

function downloadJson() {
  const content = JSON.stringify(makeExportObject(), null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "clock1-layout.json";
  link.click();
  URL.revokeObjectURL(url);
  showToast("Downloaded clock1-layout.json");
}

async function copyJson() {
  const content = JSON.stringify(makeExportObject(), null, 2);
  try {
    await navigator.clipboard.writeText(content);
    showToast("Layout JSON copied to clipboard");
  } catch {
    showToast("Clipboard unavailable — use Download JSON");
  }
}

function toggleGuides() {
  const visible = $("#showGuides").checked;
  $$(".guide-line, .guide-diagonal, .origin-crosshair").forEach((element) => { element.style.opacity = visible ? "1" : "0"; });
}

function switchTab(name) {
  $$(".tab").forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  $$(".tab-content").forEach((panel) => panel.classList.toggle("is-hidden", panel.dataset.panel !== name));
}

function bindEvents() {
  document.addEventListener("change", handleChange);
  els.overallScale.addEventListener("input", (event) => {
    state.overallScale = Number(event.target.value);
    els.overallScaleValue.textContent = `${state.overallScale.toFixed(2)}×`;
    renderLayers();
    renderPoints();
    renderStageMetadata();
    renderExportSummary();
    setStatus("Overall scale updated");
  });
  els.variantMatrix.addEventListener("click", (event) => {
    const button = event.target.closest("[data-variant-position]");
    if (!button) return;
    setActiveVariant(Number(button.dataset.variantPosition), Number(button.dataset.variantNumber));
  });
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
  $("#resetButton").addEventListener("click", resetState);
  $("#sampleButton").addEventListener("click", () => {
    state.visibleNumbers = [...REFERENCE_NUMBERS];
    state.activeVariant = { position: 0, number: REFERENCE_NUMBERS[0] };
    state.numberVariants.forEach((record) => { if (record.number === state.visibleNumbers[record.position]) record.saved = true; });
    setStatus("Loaded 04:01 reference preset");
    renderAll();
    showToast("Reference 04:01 loaded");
  });
  $("#exportButton").addEventListener("click", () => { switchTab("export"); downloadJson(); });
  $("#downloadButton").addEventListener("click", downloadJson);
  $("#copyButton").addEventListener("click", copyJson);
  $("#showGuides").addEventListener("change", toggleGuides);
  $("#importInput").addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      state = normalizeImportedState(payload);
      setStatus("Imported layout");
      renderAll();
      showToast("Layout imported");
    } catch (error) {
      setStatus("Import failed");
      showToast(error.message || "Invalid JSON layout");
    }
    event.target.value = "";
  });
  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, select, textarea")) return;
    if (event.key.toLowerCase() === "g") { $("#showGuides").checked = !$("#showGuides").checked; toggleGuides(); }
    if (event.key.toLowerCase() === "r") resetState();
  });
}

async function init() {
  setStatus("Loading SVG assets…");
  try {
    await loadDigitAssets();
    normalizeDefaultVariantHeights();
    bindEvents();
    renderAll();
    toggleGuides();
    setStatus("Assets ready");
  } catch (error) {
    setStatus("Asset load failed");
    showToast(error.message || "Unable to load SVG assets");
  }
}

init();
