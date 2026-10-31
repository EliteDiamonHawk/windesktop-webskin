# Clock1 SVG Clock Reconstruction Guide

## Purpose

This guide explains how to rebuild the Clock1 clock from a JSON layout exported by Clock1 SVG Mask Studio.

The target composition is a four-position clock arranged as:

\`\`\`
A B
C D
\`\`\`

For a conventional clock, these positions are read as \`AB:CD\`.

The reconstruction must preserve:

- Google Sans Flex traced digit SVGs at weight 1000 / Black-ExtraBlack styling.
- Four independent digit positions: A, B, C, and D.
- Locked vertical alignment within rows AB and CD.
- Shared scaling per row rather than independent scaling for individual visible digits.
- Digit-specific horizontal offsets.
- One shared mask offset and one shared mask roundness value for every digit and number.
- Connected offset-contour masks that preserve counters such as the holes in 0, 6, 8, and 9.
- Low-to-high layer order:

\`\`\`
A mask → A → B mask → B → C mask → C → D mask → D
\`\`\`

- Import/export compatibility with the layout JSON.

---

## Copy-paste Codex implementation message

Use the following as the implementation request to Codex:

~~~text
Build a Clock1 SVG clock renderer from the supplied exported layout JSON and the supplied traced Google Sans Flex digit SVG assets.

The JSON is authoritative for layout. Do not guess positions from the screenshot.

Required structure:

1. Load digit SVG assets 0.svg through 9.svg.
   - Each asset is a traced path.
   - Preserve its viewBox.
   - Preserve the path's transform attribute, including translate and scale.
   - Do not discard transforms while parsing the path.
   - The current assets use a 1000 by 1000 viewBox and Google Sans Flex weight 1000 / Black-ExtraBlack source geometry.

2. Create four digit positions:
   - A uses general point P1.
   - B uses general point P2.
   - C uses general point P3.
   - D uses general point P4.
   - The selected number for each position comes from selectedNumbers.

3. Apply geometry in this order:
   - Start with the general point.
   - Add the digit position offset.
   - Add the number variant x offset.
   - Use the shared row y value for the digit's row.
   - Use the row's shared scale.
   - Apply generalScale to the complete clock presentation.

4. Lock row alignment:
   - A and B must always have the same row y.
   - C and D must always have the same row y.
   - A and B must share the same rendered number height after row scaling.
   - C and D must share the same rendered number height after row scaling.
   - The row y values remain adjustable.
   - The x offsets remain independently adjustable.

5. Create one shared mask configuration:
   - maskSettings.offset applies to every number.
   - maskSettings.roundness applies to every number.
   - Do not permit per-number mask x, y, or scale values.
   - Every mask is rendered at the same x, y, width, height, and transform as its attached number.

6. Build masks from digit contours:
   - Parse the digit path into subpaths.
   - Flatten quadratic and cubic curves adaptively.
   - Determine contour orientation.
   - Compute outward parallel normals.
   - Offset each contour by the shared offset.
   - Connect offset segments with rounded joins controlled by roundness.
   - Fill the resulting connected outline.
   - Preserve holes using an even-odd fill rule.
   - For transformed source paths, convert the requested final SVG offset into source-path units by dividing by the absolute path scale before generating the offset path.
   - Apply the original source transform to the generated mask path.

7. Render the exact low-to-high layer order:
   - A mask, then A number.
   - B mask, then B number.
   - C mask, then C number.
   - D mask, then D number.
   - Each mask is below its attached number.
   - D is the highest digit position.

8. Export/import:
   - Preserve all fields described in this guide.
   - Keep maskVariants synchronized with shared maskSettings.
   - Import old layouts defensively.
   - Never treat a legitimate zero offset or zero coordinate as missing.

Acceptance criteria:
- Changing AB row scale changes both A and B together.
- Changing CD row scale changes both C and D together.
- Changing a row y moves both digits in that row together.
- Changing a digit x offset moves only that digit.
- Changing maskSettings.offset changes every mask.
- Changing maskSettings.roundness changes every mask join.
- The holes in 0, 6, 8, and 9 remain open.
- The output order is exactly A mask, A, B mask, B, C mask, C, D mask, D.
- Exporting and re-importing produces the same visible composition.
~~~

---

## 1. Required input files

The renderer needs:

1. The exported layout JSON.
2. The ten traced digit assets:

~~~text
0.svg
1.svg
2.svg
3.svg
4.svg
5.svg
6.svg
7.svg
8.svg
9.svg
~~~

The current traced assets have:

- \`viewBox="0 0 1000 1000"\`
- A single path per digit.
- A path-level \`transform="translate(...) scale(...)"\`.
- Google Sans Flex source metadata.
- Weight 1000.
- Black/ExtraBlack styling.
- A nonzero fill rule in the source asset.

The path transform is part of the geometry. A renderer that reads only the \`d\` attribute and ignores \`transform\` will place the digits incorrectly.

---

## 2. Export JSON structure

A current export uses schema version:

~~~json
{
  "schemaVersion": "clock1-mask-layout/2"
}
~~~

The top-level fields are:

| Field | Meaning |
|---|---|
| \`schemaVersion\` | Export format version. |
| \`units\` | Coordinate units; currently \`artboard-px\`. |
| \`generalScale\` | Overall clock scale. |
| \`generalOrigin\` | Point P1, the origin/reference point. |
| \`generalPoints\` | Four absolute general positioning points. |
| \`generalRelativePoints\` | Four general points expressed relative to P1. |
| \`digitPositions\` | Four digit offsets relative to their corresponding general points. |
| \`rowScales\` | Shared y and scale values for rows AB and CD. |
| \`maskSettings\` | One shared mask offset and roundness for all numbers. |
| \`selectedNumbers\` | The currently visible number for A, B, C, and D. |
| \`numberVariants\` | The saved placement/scale data for every position-number combination. |
| \`maskVariants\` | Forty synchronized mask records, one for each position-number combination. |
| \`savedVariants\` | Number variants explicitly marked as saved. |
| \`maskConstruction\` | Mask-generation algorithm metadata. |
| \`digitAssets\` | Source font and SVG asset metadata. |
| \`referencePreset\` | Name of the reference composition. |
| \`rendering\` | Rendering constants and stack order. |
| \`valueCount\` | Count of numeric values in the export. |

There are normally 40 number records and 40 mask records because there are four positions and ten possible numbers per position.

---

## 3. General positioning points

The clock has four general points:

~~~json
{
  "generalPoints": [
    { "point": 1, "x": 32,  "y": 18  },
    { "point": 2, "x": 226, "y": 18  },
    { "point": 3, "x": 32,  "y": 242 },
    { "point": 4, "x": 226, "y": 242 }
  ]
}
~~~

The mapping is:

| Digit position | Name | General point |
|---|---|---|
| 1 | A | P1 |
| 2 | B | P2 |
| 3 | C | P3 |
| 4 | D | P4 |

The points form the general rectangle:

~~~text
P1 ---- P2
 |       |
P3 ---- P4
~~~

### Relative points

The exported relative form is useful when reconstructing the clock from an origin:

~~~json
{
  "generalRelativePoints": [
    { "point": 1, "relativeTo": 1, "x": 0,   "y": 0   },
    { "point": 2, "relativeTo": 1, "x": 194, "y": 0   },
    { "point": 3, "relativeTo": 1, "x": 0,   "y": 224 },
    { "point": 4, "relativeTo": 1, "x": 194, "y": 224 }
  ]
}
~~~

Reconstruct absolute points with:

~~~js
const origin = layout.generalOrigin;

const points = layout.generalRelativePoints.map((record) => ({
  x: origin.x + record.x,
  y: origin.y + record.y,
}));
~~~

Because rows are locked, P1/P2 share a y value and P3/P4 share a y value.

If an imported file contains different y values for two points in the same row, use the first point in the row as authoritative and synchronize the other point.

---

## 4. Digit position offsets

The digit position offsets are relative to the corresponding general point:

~~~json
{
  "digitPositions": [
    { "digitPosition": 1, "anchorPoint": 1, "x": 0,  "y": 0 },
    { "digitPosition": 2, "anchorPoint": 2, "x": -2, "y": 0 },
    { "digitPosition": 3, "anchorPoint": 3, "x": 0,  "y": 0 },
    { "digitPosition": 4, "anchorPoint": 4, "x": -3, "y": 0 }
  ]
}
~~~

The x values are independently adjustable.

The y values are row-locked:

~~~text
digitPositions[A].y === digitPositions[B].y
digitPositions[C].y === digitPositions[D].y
~~~

A digit's base anchor is:

~~~js
const anchorX = generalPoints[position].x + digitPositions[position].x;
const anchorY = rowY[positionRow];
~~~

The number-specific x offset is applied after this anchor.

---

## 5. Row scales and vertical locking

The rows are:

~~~json
{
  "rowScales": [
    {
      "row": "AB",
      "positions": ["A", "B"],
      "y": 0,
      "scale": 1
    },
    {
      "row": "CD",
      "positions": ["C", "D"],
      "y": 0,
      "scale": 1
    }
  ]
}
~~~

A row scale applies to both numbers in that row and to both masks in that row.

Use this mapping:

~~~js
const rows = {
  AB: { positions: [0, 1] },
  CD: { positions: [2, 3] },
};

function rowForPosition(position) {
  return position < 2 ? "AB" : "CD";
}
~~~

The row scale must not be applied independently to A and B or independently to C and D.

### Equal rendered height

The current assets all use a 1000-unit viewBox. The default normalized number height is approximately 238 artboard pixels:

~~~js
const baseFactor = 0.31;
const targetGlyphHeight = 238;
const sourceViewBoxHeight = 1000;

const baseScale =
  targetGlyphHeight / (sourceViewBoxHeight * baseFactor);
// approximately 0.767742
~~~

For a number record:

~~~js
const renderedHeight =
  sourceViewBoxHeight *
  baseFactor *
  numberRecord.baseScale *
  rowScale;
~~~

For a row, the two numbers must have the same rendered height. If the source assets have different viewBox heights in a future asset set, normalize their base scales so the rendered heights match before applying row scale.

---

## 6. Number variants

Every position has a record for every number from 0 through 9.

A representative number record looks like:

~~~json
{
  "digitPosition": 1,
  "row": "AB",
  "number": 4,
  "x": 0,
  "y": 0,
  "scale": 0.767742,
  "baseScale": 0.767742,
  "rowScale": 1,
  "saved": true
}
~~~

Meaning:

- This is number 4 at position A.
- Its number-specific horizontal offset is 0.
- Its y value is the row y value, not an independent y value.
- \`baseScale\` is the number's normalized scale before row scale.
- \`rowScale\` is the shared scale for AB.
- \`scale\` is the effective scale:

~~~js
const effectiveScale =
  numberRecord.baseScale * rowScale;
~~~

For a row-locked implementation, use the exported \`baseScale\` and apply the current row scale at render time. If only \`scale\` is present, recover base scale with:

~~~js
const baseScale =
  numberRecord.scale / numberRecord.rowScale;
~~~

The active visible number for each position comes from \`selectedNumbers\`:

~~~json
{
  "selectedNumbers": [
    { "digitPosition": 1, "number": 0 },
    { "digitPosition": 2, "number": 4 },
    { "digitPosition": 3, "number": 0 },
    { "digitPosition": 4, "number": 1 }
  ]
}
~~~

This example displays \`04:01\`.

---

## 7. Rendering a number SVG

Each digit SVG contains a path and a path transform.

A safe asset loader stores:

~~~js
const definition = {
  number,
  path: pathElement.getAttribute("d"),
  transform: pathElement.getAttribute("transform") || "",
  viewBox: svgElement.getAttribute("viewBox"),
  box: parseViewBox(svgElement.getAttribute("viewBox")),
  pathScale: getAbsolutePathScale(pathElement.getAttribute("transform")),
};
~~~

The number path must receive the original transform:

~~~js
const numberPath = document.createElementNS(SVG_NS, "path");
numberPath.setAttribute("d", definition.path);
numberPath.setAttribute("fill", "currentColor");
numberPath.setAttribute("fill-rule", "nonzero");

if (definition.transform) {
  numberPath.setAttribute("transform", definition.transform);
}
~~~

Set the SVG viewport size from the source viewBox and normalized scale:

~~~js
const width =
  definition.box.width *
  baseFactor *
  numberRecord.baseScale *
  rowScale;

const height =
  definition.box.height *
  baseFactor *
  numberRecord.baseScale *
  rowScale;

svg.setAttribute("width", width);
svg.setAttribute("height", height);
svg.setAttribute("viewBox", definition.viewBox);
~~~

Do not bake away or discard the path transform unless it is deliberately folded into every path command.

---

## 8. Number position formula

For position \`position\`, the visible number is:

~~~js
const number = selectedNumbers[position].number;
const row = rowForPosition(position);
const rowScale = rowScales[row].scale;
const point = generalPoints[position];
const digitOffset = digitPositions[position];
const variant = findNumberVariant(position, number);

const left =
  point.x +
  digitOffset.x +
  variant.x;

const top =
  rowY(row);
~~~

The effective visual size is controlled by:

~~~js
const sizeScale =
  variant.baseScale *
  rowScale;
~~~

The overall scale is applied after the full clock has been laid out:

~~~css
.artboard {
  transform: scale(var(--general-scale));
  transform-origin: center;
}
~~~

This keeps the exported layout values in artboard coordinates while allowing the entire clock to be enlarged or reduced.

---

## 9. Shared mask settings

All masks use the same settings:

~~~json
{
  "maskSettings": {
    "offset": 22,
    "roundness": 100,
    "sharedAcross": "all numbers and digit positions"
  }
}
~~~

Definitions:

| Field | Meaning |
|---|---|
| \`offset\` | Distance from the digit contour in final SVG units. |
| \`roundness\` | Percentage of a circular rounded join. 0 is sharp/miter-like; 100 is fully rounded. |
| \`sharedAcross\` | Documents that the values apply globally. |

There must not be separate mask x, y, or scale controls.

Every mask uses the same:

- x position as its attached number.
- y position as its attached number.
- width as its attached number.
- height as its attached number.
- source path transform as its attached number.
- global offset.
- global roundness.

---

## 10. Mask construction algorithm

The preferred mask is a filled geometric offset of the digit contour, not a scaled duplicate of the digit.

### 10.1 Parse subpaths

Parse the source path into closed subpaths. The digits may contain multiple subpaths:

- The outer contour.
- One or more inner contours for counters.

Examples with counters include:

- 0
- 6
- 8
- 9

Each subpath must be offset independently.

### 10.2 Flatten curves

Convert line, quadratic, and cubic segments into a polyline.

Use adaptive subdivision rather than a fixed low-resolution sample count. Subdivide a curve until its control-point distance from the chord is below a small tolerance, for example:

~~~js
const flattenTolerance = 0.5;
~~~

Lower tolerance produces a more accurate mask but a larger generated path.

### 10.3 Determine contour orientation

Calculate signed polygon area:

~~~js
function polygonArea(points) {
  let area = 0;

  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];

    area +=
      points[i].x * next.y -
      next.x * points[i].y;
  }

  return area / 2;
}
~~~

Use the contour orientation to choose the outward normal. This is important because inner contours must offset in the direction that preserves the hole instead of filling it.

### 10.4 Compute parallel offset segments

For each edge:

~~~js
const direction = normalize(nextPoint - currentPoint);

// Right-hand normal in SVG coordinates:
const rightNormal = {
  x: direction.y,
  y: -direction.x,
};
~~~

Flip the normal according to contour orientation, then move each segment by the shared offset.

The result is a set of parallel offset segments.

### 10.5 Connect joins

At every original vertex:

1. Compute the incoming offset segment.
2. Compute the outgoing offset segment.
3. Intersect their infinite lines to obtain a miter point.
4. If the corner is convex and roundness is greater than zero, connect using a circular or quadratic rounded join.
5. If the corner is concave, connect using the offset-line intersection.
6. Limit extreme miters to prevent pathological spikes at acute angles.

At 100% roundness, a join can be represented with an SVG arc:

~~~svg
A offset offset 0 0 sweepFlag endX endY
~~~

At intermediate roundness, interpolate between a miter control point and the original vertex.

### 10.6 Fill the generated contours

Use:

~~~svg
fill="currentColor"
fill-rule="evenodd"
~~~

The even-odd rule preserves counters when the outer and inner offset contours are emitted as separate subpaths.

### 10.7 Preserve transformed assets

The current traced assets have a path transform similar to:

~~~svg
transform="translate(158.8064,860.8488) scale(0.504,-0.504)"
~~~

The exported offset is expressed in final 1000×1000 SVG units. The mask generator works in the path's local coordinate system, so convert the offset before generation:

~~~js
const localOffset =
  maskSettings.offset / definition.pathScale;
~~~

Then:

~~~js
const maskPathData =
  buildOffsetMaskPath(
    definition.path,
    localOffset,
    maskSettings.roundness
  );

maskPath.setAttribute("d", maskPathData);
maskPath.setAttribute("transform", definition.transform);
~~~

This ensures that the final visible offset remains the requested amount after the source transform is applied.

---

## 11. Mask and number sizing

The mask must use the same viewport size as the number:

~~~js
const maskSvg = createSvg(definition.viewBox);

maskSvg.setAttribute("width", numberWidth);
maskSvg.setAttribute("height", numberHeight);
~~~

Do not make the mask SVG itself wider or taller to create the offset. The generated mask path extends beyond the original contour inside the same SVG coordinate system.

Set overflow to visible so the offset contour is not clipped:

~~~css
.digit-svg,
.layer svg {
  display: block;
  overflow: visible;
}
~~~

The mask and number must use the exact same:

~~~js
left
top
width
height
transform
~~~

Only their path data and color differ.

---

## 12. Layer order

Use explicit z-index values or append order. The required low-to-high order is:

~~~js
const stackLowToHigh = [
  "A mask",
  "A",
  "B mask",
  "B",
  "C mask",
  "C",
  "D mask",
  "D",
];
~~~

A simple numeric mapping is:

~~~js
const maskZ = position * 2 + 1;
const numberZ = position * 2 + 2;
~~~

This gives:

| Element | z-index |
|---|---:|
| A mask | 1 |
| A number | 2 |
| B mask | 3 |
| B number | 4 |
| C mask | 5 |
| C number | 6 |
| D mask | 7 |
| D number | 8 |

This ordering matters when digits overlap. D must be visually highest.

---

## 13. Mask variant export records

The export keeps 40 mask records for compatibility, but all records must be identical in their mask settings:

~~~json
{
  "maskVariants": [
    {
      "digitPosition": 1,
      "row": "AB",
      "number": 0,
      "offset": 22,
      "roundness": 100,
      "shared": true
    }
  ]
}
~~~

The real source of truth is:

~~~json
{
  "maskSettings": {
    "offset": 22,
    "roundness": 100
  }
}
~~~

When exporting:

~~~js
const maskVariants = allPositionNumberPairs.map((record) => ({
  digitPosition: record.position + 1,
  row: rowForPosition(record.position),
  number: record.number,
  offset: maskSettings.offset,
  roundness: maskSettings.roundness,
  shared: true,
}));
~~~

When importing:

1. Read \`maskSettings\` if present.
2. If it is absent, read the first valid mask record.
3. If importing an older export where \`roundness\` represented the old stroke width, use that value as the fallback offset.
4. Synchronize all mask records from the resulting shared settings.
5. Do not allow one record to diverge from the global settings.

---

## 14. Saved number variants

The \`saved\` property applies to number variants, not to mask geometry:

~~~json
{
  "savedVariants": [
    { "digitPosition": 1, "number": 0 },
    { "digitPosition": 2, "number": 4 }
  ]
}
~~~

A saved number means the user marked that position-number combination as important for later export or reconstruction.

The selected visible numbers are separate:

~~~json
{
  "selectedNumbers": [
    { "digitPosition": 1, "number": 0 },
    { "digitPosition": 2, "number": 4 },
    { "digitPosition": 3, "number": 0 },
    { "digitPosition": 4, "number": 1 }
  ]
}
~~~

Do not confuse:

- selected = currently visible.
- saved = explicitly marked for later use.

---

## 15. Complete reconstruction pseudocode

~~~js
const layout = await loadJson("clock1-layout.json");
const digitDefinitions = await loadDigitAssets();

const positions = [
  { name: "A", index: 0, row: "AB", point: 0 },
  { name: "B", index: 1, row: "AB", point: 1 },
  { name: "C", index: 2, row: "CD", point: 2 },
  { name: "D", index: 3, row: "CD", point: 3 },
];

const rowScaleByName = Object.fromEntries(
  layout.rowScales.map((row) => [row.row, row.scale])
);

const rowYByName = Object.fromEntries(
  layout.rowScales.map((row) => [row.row, row.y])
);

for (const position of positions) {
  const selected = layout.selectedNumbers.find(
    (record) => record.digitPosition === position.index + 1
  );

  const number = selected.number;
  const definition = digitDefinitions.get(number);

  const point = layout.generalPoints[position.point];
  const digitOffset = layout.digitPositions[position.index];

  const numberVariant = layout.numberVariants.find(
    (record) =>
      record.digitPosition === position.index + 1 &&
      record.number === number
  );

  const rowScale = rowScaleByName[position.row];
  const rowY = rowYByName[position.row];

  const left =
    point.x +
    digitOffset.x +
    numberVariant.x;

  const top =
    rowY;

  const effectiveScale =
    numberVariant.baseScale *
    rowScale;

  const numberLayer = createNumberLayer({
    definition,
    left,
    top,
    scale: effectiveScale,
  });

  const maskLayer = createMaskLayer({
    definition,
    left,
    top,
    scale: effectiveScale,
    offset: layout.maskSettings.offset,
    roundness: layout.maskSettings.roundness,
  });

  appendAtZIndex(maskLayer, position.index * 2 + 1);
  appendAtZIndex(numberLayer, position.index * 2 + 2);
}

artboard.style.transform =
  \`scale(\${layout.generalScale})\`;
~~~

The actual implementation can use absolute-positioned HTML layers containing inline SVGs, or a single SVG scene with grouped layers. The important requirement is that the coordinate formulas and z-order remain the same.

---

## 16. Import normalization rules

A robust importer should accept current and older exports.

### Current format

Use:

~~~js
layout.maskSettings.offset
layout.maskSettings.roundness
~~~

### Older format

Older exports may contain mask fields directly on each record:

~~~json
{
  "maskVariants": [
    {
      "digitPosition": 1,
      "number": 0,
      "roundness": 22
    }
  ]
}
~~~

For this older format, interpret the old \`roundness\` stroke-width value as the new offset and use the default roundness percentage:

~~~js
if (!layout.maskSettings && legacyRecord.roundness != null) {
  maskSettings.offset = legacyRecord.roundness;
  maskSettings.roundness = 100;
}
~~~

Always preserve zero:

~~~js
const x = Number(record.x);

if (Number.isFinite(x)) {
  target.x = x;
}
~~~

Do not use truthiness checks such as:

~~~js
if (record.x) {
  // Incorrect: this rejects legitimate zero.
}
~~~

---

## 17. Validation checklist

After implementing the renderer, verify:

### Geometry

- P1 through P4 are loaded.
- P2 and P4 stay on the same y rows as P1 and P3.
- A/B share row y.
- C/D share row y.
- x offsets remain independent.
- Overall scale affects the complete clock.

### Number rendering

- All ten SVGs load.
- All source path transforms are preserved.
- Every digit uses the correct viewBox.
- Numbers in the same row have equal rendered height.
- Row scale affects both numbers in a row.
- Selected numbers correspond to A, B, C, and D.

### Mask rendering

- There is exactly one shared mask offset.
- There is exactly one shared mask roundness.
- Changing the shared offset changes all masks.
- Changing the shared roundness changes all joins.
- Masks use the same x, y, width, height, and transform as their numbers.
- Masks are filled offset contours, not scaled duplicate glyphs.
- Holes in 0, 6, 8, and 9 remain open.
- Masks do not use independent x, y, or scale controls.

### Layering

- A mask is below A.
- B mask is below B.
- C mask is below C.
- D mask is below D.
- D is above every other digit and mask.
- The final low-to-high order is exactly:

~~~text
A mask → A → B mask → B → C mask → C → D mask → D
~~~

### Export/import

- Export contains \`maskSettings\`.
- All maskVariants have the same offset.
- All maskVariants have the same roundness.
- Export contains general points and relative points.
- Export contains digit positions.
- Export contains row scales.
- Export contains number variants.
- Export contains selected numbers.
- Export contains saved variants.
- Import/export round trips preserve visible geometry.
- Zero offsets and zero positions survive the round trip.

---

## 18. Common implementation mistakes

### Ignoring the source path transform

Bad:

~~~js
path.setAttribute("d", sourcePath);
~~~

Correct:

~~~js
path.setAttribute("d", sourcePath);
path.setAttribute("transform", sourceTransform);
~~~

The current assets use transformed local coordinates.

### Scaling each visible number independently

Bad:

~~~js
A.scale = 1.1;
B.scale = 0.9;
~~~

Correct:

~~~js
AB.rowScale = 1.0;
~~~

Base glyph scales normalize the source assets; row scale is the user-facing scale control.

### Giving masks their own position

Bad:

~~~js
mask.left = number.left + mask.x;
mask.top = number.top + mask.y;
~~~

Correct:

~~~js
mask.left = number.left;
mask.top = number.top;
~~~

The mask follows the attached number exactly.

### Using a rectangle or generic blob as the mask

The mask must follow the digit contour and preserve counters. Do not replace it with a rounded rectangle, circle, or generic outline.

### Replacing the offset mask with a scaled digit

A larger duplicate digit is not a proper offset. Use parallel contour offsets with connected joins.

### Allowing per-record mask values

The current design intentionally has one global mask offset and one global roundness. Per-record mask values may be emitted for compatibility, but they must stay synchronized.

### Using CSS transforms for layout coordinates

CSS transforms are appropriate for \`generalScale\`, but the exported x/y geometry should remain explicit artboard coordinates. Keep the layout calculation visible and deterministic.

---

## 19. Minimal export contract

If a future implementation wants a smaller input format, these fields are the minimum required to reconstruct the current clock:

~~~json
{
  "generalScale": 1,
  "generalPoints": [
    { "point": 1, "x": 32, "y": 18 },
    { "point": 2, "x": 226, "y": 18 },
    { "point": 3, "x": 32, "y": 242 },
    { "point": 4, "x": 226, "y": 242 }
  ],
  "digitPositions": [
    { "digitPosition": 1, "x": 0, "y": 0 },
    { "digitPosition": 2, "x": -2, "y": 0 },
    { "digitPosition": 3, "x": 0, "y": 0 },
    { "digitPosition": 4, "x": -3, "y": 0 }
  ],
  "rowScales": [
    { "row": "AB", "y": 0, "scale": 1 },
    { "row": "CD", "y": 0, "scale": 1 }
  ],
  "selectedNumbers": [
    { "digitPosition": 1, "number": 0 },
    { "digitPosition": 2, "number": 4 },
    { "digitPosition": 3, "number": 0 },
    { "digitPosition": 4, "number": 1 }
  ],
  "maskSettings": {
    "offset": 22,
    "roundness": 100
  }
}
~~~

For exact reconstruction of every saved number option, also include the complete \`numberVariants\` array.

---

## 20. Final implementation principle

Treat the JSON export as a deterministic layout recipe:

1. Load the exact traced SVG assets.
2. Preserve every source path transform.
3. Normalize glyph heights.
4. Reconstruct general points.
5. Apply row-locked digit offsets.
6. Apply selected number variants.
7. Apply shared row scale.
8. Generate one shared-parameter contour mask per visible number.
9. Render the required z-order.
10. Apply generalScale to the complete clock.
11. Export the same normalized state for future reconstruction.

The output should be reproducible from the JSON and the ten SVG assets without relying on hidden editor state.

