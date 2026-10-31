const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._-]*$/;
const MODULE_PATH = /^(?!\/)(?![A-Za-z]:)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\).+\.js$/;
const SAFE_CSS_VALUE = /^[^;{}<>"']+$/;

const ANCHORS = {
  "top-left": [0, 0],
  top: [0.5, 0],
  "top-right": [1, 0],
  left: [0, 0.5],
  center: [0.5, 0.5],
  right: [1, 0.5],
  "bottom-left": [0, 1],
  bottom: [0.5, 1],
  "bottom-right": [1, 1],
};

const MIME_TYPES = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".mov": "video/quicktime",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

const asObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const escapeCssIdentifier = (value) => {
  const token = String(value).replace(/[^A-Za-z0-9_-]/g, "-");
  return /^[A-Za-z_]/.test(token) ? token : `n-${token}`;
};

const normalizePath = (value, label = "path") => {
  if (typeof value !== "string" || !value || value.includes("\0")) {
    throw new Error(`${label} must be a non-empty relative path`);
  }
  const path = value.replaceAll("\\", "/");
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) {
    throw new Error(`${label} must be relative`);
  }
  const parts = path.split("/").filter((part) => part && part !== ".");
  if (parts.some((part) => part === "..")) {
    throw new Error(`${label} must not escape the theme root`);
  }
  return parts.join("/");
};

const resolvePath = (baseFile, relativePath) => {
  const base = baseFile.includes("/") ? baseFile.slice(0, baseFile.lastIndexOf("/")) : "";
  return normalizePath(base ? `${base}/${relativePath}` : relativePath);
};

const extensionOf = (path) => {
  const match = /\.[^./]+$/.exec(path);
  return match ? match[0].toLowerCase() : "";
};

const typeForPath = (path) => MIME_TYPES[extensionOf(path)] ?? "application/octet-stream";

const isBlob = (value) => typeof Blob !== "undefined" && value instanceof Blob;

const readText = async (value) => {
  if (typeof value === "string") return value;
  if (isBlob(value)) return value.text();
  if (value instanceof ArrayBuffer) return new TextDecoder().decode(value);
  if (ArrayBuffer.isView(value)) return new TextDecoder().decode(value);
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
};

const sourceEntries = (input) => {
  const value = input?.files ?? input;
  if (value instanceof Map) return [...value.entries()].map(([path, file]) => ({ path, file }));

  if (typeof FileList !== "undefined" && value instanceof FileList) {
    return Array.from(value).map((file) => ({
      path: file.webkitRelativePath || file.name,
      file,
    }));
  }

  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (entry && typeof entry === "object" && "file" in entry) {
        return { path: entry.path || entry.file.webkitRelativePath || entry.file.name, file: entry.file };
      }
      return { path: entry.webkitRelativePath || entry.name, file: entry };
    });
  }

  if (asObject(value)) return Object.entries(value).map(([path, file]) => ({ path, file }));
  throw new TypeError("Compiler input must contain a FileList, array, Map, or path-to-file object");
};

const loadSources = async (input, diagnostics) => {
  const files = new Map();
  for (const entry of sourceEntries(input)) {
    try {
      const path = normalizePath(entry.path, "source file path");
      files.set(path, entry.file);
    } catch (error) {
      diagnostics.push(makeDiagnostic("error", "WS-UNSAFE-PATH", error.message, String(entry.path || "<unknown>")));
    }
  }
  return files;
};

const parseJson = async (sources, path, diagnostics) => {
  if (!sources.has(path)) {
    diagnostics.push(makeDiagnostic("error", "WS-MISSING-FILE", `Referenced file does not exist: ${path}`, path));
    return null;
  }

  try {
    return JSON.parse(await readText(sources.get(path)));
  } catch (error) {
    const message = String(error?.message || error);
    const position = Number(message.match(/position (\d+)/i)?.[1] ?? 0);
    const text = await readText(sources.get(path));
    const before = text.slice(0, position);
    const line = before.split("\n").length;
    const column = position - before.lastIndexOf("\n");
    diagnostics.push(makeDiagnostic("error", "WS-INVALID-JSON", message, path, line, column));
    return null;
  }
};

const makeDiagnostic = (severity, code, message, file, line = 1, column = 1, jsonPointer = undefined) => ({
  severity,
  code,
  message,
  file,
  line,
  column,
  ...(jsonPointer ? { jsonPointer } : {}),
});

const error = (diagnostics, code, message, file, jsonPointer = undefined) => {
  diagnostics.push(makeDiagnostic("error", code, message, file, 1, 1, jsonPointer));
};

const warning = (diagnostics, code, message, file, jsonPointer = undefined) => {
  diagnostics.push(makeDiagnostic("warning", code, message, file, 1, 1, jsonPointer));
};

const checkIdentifier = (value, diagnostics, file, pointer) => {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    error(diagnostics, "WS-INVALID-ID", "Expected an identifier such as `clock` or `main-layer`", file, pointer);
    return false;
  }
  return true;
};

const checkRelativePath = (value, diagnostics, file, pointer, { module = false } = {}) => {
  try {
    const path = normalizePath(value, pointer);
    if (module && !MODULE_PATH.test(path)) throw new Error("module path must be a relative .js path");
    return true;
  } catch (validationError) {
    error(diagnostics, module ? "WS-INVALID-MODULE-PATH" : "WS-UNSAFE-PATH", validationError.message, file, pointer);
    return false;
  }
};

const checkMeasure = (value, diagnostics, file, pointer) => {
  if (!asObject(value) || typeof value.value !== "number" || !Number.isFinite(value.value)
    || !["px", "percent", "vw", "vh", "rem"].includes(value.unit)) {
    error(diagnostics, "WS-INVALID-MEASURE", "Expected a finite value with unit px, percent, vw, vh, or rem", file, pointer);
    return false;
  }
  return value.value >= 0;
};

const checkSize = (value, diagnostics, file, pointer) => {
  if (!asObject(value)) {
    error(diagnostics, "WS-INVALID-SIZE", "Size must be an object", file, pointer);
    return false;
  }
  for (const key of ["width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight"]) {
    if (!(key in value)) continue;
    if (value[key] !== "auto" && !checkMeasure(value[key], diagnostics, file, `${pointer}/${key}`)) return false;
  }
  return true;
};

const checkPlacement = (value, diagnostics, file, pointer) => {
  if (value === undefined) return true;
  if (!asObject(value) || typeof value.mode !== "string") {
    error(diagnostics, "WS-INVALID-PLACEMENT", "Placement must declare a mode", file, pointer);
    return false;
  }
  if (value.mode === "absolute") {
    checkMeasure(value.x, diagnostics, file, `${pointer}/x`);
    checkMeasure(value.y, diagnostics, file, `${pointer}/y`);
  } else if (value.mode === "anchor") {
    if (!isAnchor(value.source) || !isAnchor(value.target)) {
      error(diagnostics, "WS-INVALID-PLACEMENT", "Anchor placement requires valid source and target anchors", file, pointer);
    }
    if (value.offsetX !== undefined) checkMeasure(value.offsetX, diagnostics, file, `${pointer}/offsetX`);
    if (value.offsetY !== undefined) checkMeasure(value.offsetY, diagnostics, file, `${pointer}/offsetY`);
  } else if (value.mode === "dock") {
    if (typeof value.edge !== "string" || !ANCHORS[value.edge]) {
      error(diagnostics, "WS-INVALID-PLACEMENT", "Dock placement requires a named edge", file, pointer);
    }
    if (value.offsetX !== undefined) checkMeasure(value.offsetX, diagnostics, file, `${pointer}/offsetX`);
    if (value.offsetY !== undefined) checkMeasure(value.offsetY, diagnostics, file, `${pointer}/offsetY`);
  } else if (value.mode !== "flow") {
    error(diagnostics, "WS-INVALID-PLACEMENT", `Unsupported placement mode: ${value.mode}`, file, pointer);
  }
  return true;
};

const isAnchor = (value) => typeof value === "string" ? Boolean(ANCHORS[value]) : Boolean(
  asObject(value) && Number.isFinite(value.x) && Number.isFinite(value.y)
    && value.x >= 0 && value.x <= 1 && value.y >= 0 && value.y <= 1,
);

const anchorPoint = (value) => typeof value === "string" ? ANCHORS[value] : [value.x, value.y];

const validateTheme = (theme, diagnostics, sources) => {
  const file = "theme.json";
  if (!asObject(theme)) {
    error(diagnostics, "WS-INVALID-THEME", "theme.json must contain an object", file);
    return null;
  }
  if (theme.schemaVersion !== 1) error(diagnostics, "WS-UNSUPPORTED-SCHEMA", "schemaVersion must be 1", file, "/schemaVersion");
  checkIdentifier(theme.id, diagnostics, file, "/id");
  if (typeof theme.name !== "string" || !theme.name.trim()) error(diagnostics, "WS-INVALID-THEME", "name must be a non-empty string", file, "/name");
  if (!asObject(theme.files) || typeof theme.files.scene !== "string") {
    error(diagnostics, "WS-MISSING-SCENE", "files.scene is required", file, "/files/scene");
    return theme;
  }
  if (theme.files.styles !== undefined && (!Array.isArray(theme.files.styles)
    || theme.files.styles.some((style) => typeof style !== "string"))) {
    error(diagnostics, "WS-INVALID-STYLES", "files.styles must be an array of relative paths", file, "/files/styles");
  }
  let scenePath;
  try {
    scenePath = resolvePath(file, theme.files.scene);
  } catch (validationError) {
    error(diagnostics, "WS-UNSAFE-PATH", validationError.message, file, "/files/scene");
  }
  if (scenePath && !sources.has(scenePath)) error(diagnostics, "WS-MISSING-FILE", `Scene file does not exist: ${scenePath}`, file, "/files/scene");

  const viewport = theme.viewport;
  if (!asObject(viewport) || !asObject(viewport.designSize)
    || !Number.isInteger(viewport.designSize.width) || viewport.designSize.width < 1
    || !Number.isInteger(viewport.designSize.height) || viewport.designSize.height < 1) {
    error(diagnostics, "WS-INVALID-VIEWPORT", "viewport.designSize must contain positive integer width and height", file, "/viewport/designSize");
  }
  if (!viewport || !["responsive", "design-space", "fixed"].includes(viewport.fit)) {
    error(diagnostics, "WS-INVALID-VIEWPORT", "viewport.fit must be responsive, design-space, or fixed", file, "/viewport/fit");
  }
  if (!viewport || !["hidden", "visible", "scroll"].includes(viewport.overflow)) {
    error(diagnostics, "WS-INVALID-VIEWPORT", "viewport.overflow must be hidden, visible, or scroll", file, "/viewport/overflow");
  }

  const profiles = theme.screenSupport?.profiles;
  if (!Array.isArray(profiles) || profiles.length === 0) {
    error(diagnostics, "WS-INVALID-PROFILE", "screenSupport.profiles must contain at least one profile", file, "/screenSupport/profiles");
  } else {
    const ids = new Set();
    for (const [index, profile] of profiles.entries()) {
      checkIdentifier(profile?.id, diagnostics, file, `/screenSupport/profiles/${index}/id`);
      if (ids.has(profile?.id)) error(diagnostics, "WS-DUPLICATE-ID", `Duplicate screen profile ID: ${profile.id}`, file, `/screenSupport/profiles/${index}/id`);
      ids.add(profile?.id);
    }
    if (!ids.has(theme.screenSupport.fallbackProfile)) error(diagnostics, "WS-MISSING-FALLBACK", "fallbackProfile must reference a declared profile", file, "/screenSupport/fallbackProfile");
  }
  return { ...theme, scenePath };
};

const validateModule = (module, diagnostics, file, pointer) => {
  if (!asObject(module) || !checkRelativePath(module.path, diagnostics, file, `${pointer}/path`, { module: true })) return false;
  if (typeof module.export !== "string" || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(module.export)) {
    error(diagnostics, "WS-INVALID-MODULE-EXPORT", "Module export must be a valid JavaScript export name", file, `${pointer}/export`);
    return false;
  }
  return true;
};

const validateNode = (node, diagnostics, sources, ids, file, pointer, dependencies, assets) => {
  if (!asObject(node)) {
    error(diagnostics, "WS-INVALID-NODE", "Scene nodes must be objects", file, pointer);
    return;
  }
  checkIdentifier(node.id, diagnostics, file, `${pointer}/id`);
  if (ids.has(node.id)) error(diagnostics, "WS-DUPLICATE-ID", `Duplicate scene node ID: ${node.id}`, file, `${pointer}/id`);
  ids.add(node.id);
  checkPlacement(node.placement, diagnostics, file, `${pointer}/placement`);
  if (node.size !== undefined) checkSize(node.size, diagnostics, file, `${pointer}/size`);
  if (node.opacity !== undefined && (typeof node.opacity !== "number" || node.opacity < 0 || node.opacity > 1)) {
    error(diagnostics, "WS-INVALID-OPACITY", "opacity must be between 0 and 1", file, `${pointer}/opacity`);
  }

  if (node.kind === "stack") {
    if (!Array.isArray(node.layers)) error(diagnostics, "WS-INVALID-NODE", "stack.layers must be an array", file, `${pointer}/layers`);
    else node.layers.forEach((layer, index) => validateNode(layer, diagnostics, sources, ids, file, `${pointer}/layers/${index}`, dependencies, assets));
    return;
  }
  if (node.kind === "layer") {
    if (!asObject(node.content)) error(diagnostics, "WS-INVALID-NODE", "layer.content is required", file, `${pointer}/content`);
    else validateNode(node.content, diagnostics, sources, ids, file, `${pointer}/content`, dependencies, assets);
    return;
  }
  if (node.kind === "layout") {
    if (!asObject(node.layout) || !["h-stack", "v-stack", "grid", "center"].includes(node.layout.type)) {
      error(diagnostics, "WS-INVALID-LAYOUT", "MVP layout must be h-stack, v-stack, grid, or center", file, `${pointer}/layout`);
    }
    if (node.layout?.type === "grid" && (!Array.isArray(node.layout.columns) || !Array.isArray(node.layout.rows))) {
      error(diagnostics, "WS-INVALID-LAYOUT", "grid requires columns and rows", file, `${pointer}/layout`);
    }
    if (node.layout?.gap !== undefined) checkMeasure(node.layout.gap, diagnostics, file, `${pointer}/layout/gap`);
    if (!Array.isArray(node.children)) error(diagnostics, "WS-INVALID-NODE", "layout.children must be an array", file, `${pointer}/children`);
    else node.children.forEach((child, index) => validateNode(child, diagnostics, sources, ids, file, `${pointer}/children/${index}`, dependencies, assets));
    return;
  }
  if (node.kind === "asset") {
    if (!checkRelativePath(node.src, diagnostics, file, `${pointer}/src`)) return;
    let assetPath;
    try { assetPath = resolvePath(file, node.src); } catch (validationError) {
      error(diagnostics, "WS-UNSAFE-PATH", validationError.message, file, `${pointer}/src`);
      return;
    }
    if (!sources.has(assetPath)) error(diagnostics, "WS-MISSING-ASSET", `Asset does not exist: ${assetPath}`, file, `${pointer}/src`);
    assets.add(assetPath);
    if (!["image", "animated-image", "video"].includes(node.media)) error(diagnostics, "WS-INVALID-ASSET", "media must be image, animated-image, or video", file, `${pointer}/media`);
    return;
  }
  if (node.kind === "widget" || node.kind === "component") {
    if (validateModule(node.module, diagnostics, file, `${pointer}/module`)) dependencies.push({ ...node.module, kind: node.kind, nodeId: node.id });
    return;
  }
  error(diagnostics, "WS-UNKNOWN-NODE", `Unsupported scene node kind: ${node.kind}`, file, `${pointer}/kind`);
};

const validateScene = (scene, diagnostics, sources, scenePath) => {
  if (!asObject(scene)) {
    error(diagnostics, "WS-INVALID-SCENE", "scene.json must contain an object", scenePath);
    return null;
  }
  if (scene.schemaVersion !== 1) error(diagnostics, "WS-UNSUPPORTED-SCHEMA", "schemaVersion must be 1", scenePath, "/schemaVersion");
  const root = scene.root;
  if (!asObject(root) || root.kind !== "stack") {
    error(diagnostics, "WS-INVALID-SCENE", "root must be a stack", scenePath, "/root");
    return null;
  }
  if (!asObject(root.background) || root.background.kind !== "background") {
    error(diagnostics, "WS-MISSING-BACKGROUND", "root.background is required", scenePath, "/root/background");
  }
  const dependencies = [];
  const assets = new Set();
  const ids = new Set();
  if (root.background) {
    ids.add("background");
    const composition = root.background.composition;
    if (!asObject(composition) || !asObject(composition.main) || typeof composition.main.src !== "string") {
      error(diagnostics, "WS-INVALID-COMPOSITION", "background.composition.main.src is required", scenePath, "/root/background/composition/main/src");
    } else {
      try {
        const mainPath = resolvePath(scenePath, composition.main.src);
        if (!sources.has(mainPath)) error(diagnostics, "WS-MISSING-ASSET", `Background asset does not exist: ${mainPath}`, scenePath, "/root/background/composition/main/src");
        assets.add(mainPath);
      } catch (validationError) {
        error(diagnostics, "WS-UNSAFE-PATH", validationError.message, scenePath, "/root/background/composition/main/src");
      }
    }
    if (!asObject(composition?.anchor) || !isAnchor(composition.anchor.source) || !isAnchor(composition.anchor.viewport)) {
      error(diagnostics, "WS-INVALID-COMPOSITION", "background anchor requires valid source and viewport anchors", scenePath, "/root/background/composition/anchor");
    }
    if (!Array.isArray(composition?.overlays)) {
      error(diagnostics, "WS-INVALID-COMPOSITION", "background overlays must be an array", scenePath, "/root/background/composition/overlays");
    }
    for (const [index, overlay] of (composition?.overlays ?? []).entries()) {
      if (!asObject(overlay) || typeof overlay.src !== "string") {
        error(diagnostics, "WS-INVALID-COMPOSITION", "background overlay requires src", scenePath, `/root/background/composition/overlays/${index}`);
        continue;
      }
      try {
        const overlayPath = resolvePath(scenePath, overlay.src);
        if (!sources.has(overlayPath)) error(diagnostics, "WS-MISSING-ASSET", `Background overlay does not exist: ${overlayPath}`, scenePath, `/root/background/composition/overlays/${index}/src`);
        assets.add(overlayPath);
      } catch (validationError) {
        error(diagnostics, "WS-UNSAFE-PATH", validationError.message, scenePath, `/root/background/composition/overlays/${index}/src`);
      }
    }
  }
  if (!Array.isArray(root.layers)) error(diagnostics, "WS-INVALID-SCENE", "root.layers must be an array", scenePath, "/root/layers");
  else root.layers.forEach((layer, index) => validateNode(layer, diagnostics, sources, ids, scenePath, `/root/layers/${index}`, dependencies, assets));
  return { scene, dependencies, assets: [...assets] };
};

const cssMeasure = (value) => {
  if (value === "auto") return "auto";
  if (!value || typeof value.value !== "number") return undefined;
  return `${value.value}${value.unit === "percent" ? "%" : value.unit}`;
};

const cssEdges = (value) => {
  if (!value) return undefined;
  if (value.value !== undefined) return cssMeasure(value);
  return ["top", "right", "bottom", "left"].map((edge) => cssMeasure(value[edge]) || "0").join(" ");
};

const cssAnchor = (value) => anchorPoint(value);

const baseNodeStyle = (node) => {
  const style: Record<string, string | number> = {};
  if (node.opacity !== undefined) style.opacity = node.opacity;
  if (node.visible === false) style.display = "none";
  if (node.size) {
    for (const key of ["width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight"]) {
      const cssKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      const cssValue = cssMeasure(node.size[key]);
      if (cssValue) style[cssKey] = cssValue;
    }
  }
  const placement = node.placement;
  if (!placement || placement.mode === "flow") return style;
  style.position = "absolute";
  if (placement.mode === "absolute") {
    style.left = cssMeasure(placement.x);
    style.top = cssMeasure(placement.y);
  } else if (placement.mode === "anchor") {
    const source = cssAnchor(placement.source);
    const target = cssAnchor(placement.target);
    style.left = `${target[0] * 100}%`;
    style.top = `${target[1] * 100}%`;
    style.transform = `translate(${-source[0] * 100}%, ${-source[1] * 100}%)`;
    if (placement.offsetX) style.marginLeft = cssMeasure(placement.offsetX);
    if (placement.offsetY) style.marginTop = cssMeasure(placement.offsetY);
  } else if (placement.mode === "dock") {
    const [x, y] = cssAnchor(placement.edge);
    style.left = `${x * 100}%`;
    style.top = `${y * 100}%`;
    style.transform = `translate(${-x * 100}%, ${-y * 100}%)`;
    if (placement.offsetX) style.marginLeft = cssMeasure(placement.offsetX);
    if (placement.offsetY) style.marginTop = cssMeasure(placement.offsetY);
  }
  return style;
};

const styleText = (style) => Object.entries(style)
  .filter(([, value]) => value !== undefined)
  .map(([key, value]) => `${key}:${value}`)
  .join(";");

const safeTrack = (value) => {
  if (typeof value !== "string" || !value.trim() || !SAFE_CSS_VALUE.test(value)) throw new Error(`Unsafe CSS track value: ${value}`);
  return value.trim();
};

const layoutStyle = (layout) => {
  const style: Record<string, string | number> = { boxSizing: "border-box", minWidth: 0, minHeight: 0 };
  if (layout.type === "h-stack" || layout.type === "v-stack") {
    style.display = "flex";
    style.flexDirection = layout.type === "h-stack" ? "row" : "column";
    if (layout.gap) style.gap = cssMeasure(layout.gap);
    if (layout.padding) style.padding = cssEdges(layout.padding);
    if (layout.align) style.alignItems = layout.align === "start" ? "flex-start" : layout.align === "end" ? "flex-end" : layout.align;
    if (layout.justify) style.justifyContent = layout.justify === "start" ? "flex-start" : layout.justify === "end" ? "flex-end" : layout.justify;
    if (layout.wrap) style.flexWrap = "wrap";
  } else if (layout.type === "center") {
    style.display = "grid";
    style.placeItems = "center";
    if (layout.padding) style.padding = cssEdges(layout.padding);
  } else if (layout.type === "grid") {
    style.display = "grid";
    style.gridTemplateColumns = layout.columns.map(safeTrack).join(" ");
    style.gridTemplateRows = layout.rows.map(safeTrack).join(" ");
    if (layout.gap) style.gap = cssMeasure(layout.gap);
    if (layout.padding) style.padding = cssEdges(layout.padding);
  }
  return style;
};

const makeCompiledFile = (path, content, type = typeForPath(path)) => {
  const blob = isBlob(content) ? content : new Blob([content], { type });
  const file = typeof File === "function" ? new File([blob], path, { type }) : blob;
  return { path, file, blob, type, size: blob.size };
};

const renderCompilerRuntime = (widgets) => `const WIDGETS = ${JSON.stringify(widgets)};

const anchors = {
  "top-left": [0, 0], top: [.5, 0], "top-right": [1, 0], left: [0, .5],
  center: [.5, .5], right: [1, .5], "bottom-left": [0, 1], bottom: [.5, 1], "bottom-right": [1, 1],
};

const point = (value) => typeof value === "string" ? anchors[value] : [value.x, value.y];

const layoutBackground = (background) => {
  const main = background.querySelector("[data-ws-background-main]");
  if (!main?.naturalWidth || !main.naturalHeight) return;
  const frame = background.getBoundingClientRect();
  const composition = JSON.parse(background.dataset.wsComposition);
  const source = point(composition.anchor.source);
  const viewport = point(composition.anchor.viewport);
  const scale = Math.max(frame.width / main.naturalWidth, frame.height / main.naturalHeight);
  const width = main.naturalWidth * scale;
  const height = main.naturalHeight * scale;
  const left = viewport[0] * frame.width - source[0] * width;
  const top = viewport[1] * frame.height - source[1] * height;
  Object.assign(main.style, { width: width + "px", height: height + "px", left: left + "px", top: top + "px" });
  background.querySelectorAll("[data-ws-background-overlay]").forEach((overlay) => {
    if (!overlay.naturalWidth || !overlay.naturalHeight) return;
    const config = JSON.parse(overlay.dataset.wsOverlay);
    const overlayWidth = overlay.naturalWidth * scale * (config.scale ?? 1);
    const overlayHeight = overlay.naturalHeight * scale * (config.scale ?? 1);
    const anchor = point(config.anchor ?? { x: .5, y: .5 });
    Object.assign(overlay.style, {
      width: overlayWidth + "px", height: overlayHeight + "px",
      left: left + config.x * scale - anchor[0] * overlayWidth + "px",
      top: top + config.y * scale - anchor[1] * overlayHeight + "px",
      opacity: config.opacity ?? 1,
      transform: "rotate(" + (config.rotation ?? 0) + "deg) scale(" + (config.flipX ? -1 : 1) + "," + (config.flipY ? -1 : 1) + ")",
    });
  });
};

const mount = async () => {
  document.querySelectorAll("[data-ws-background]").forEach((background) => {
    const update = () => layoutBackground(background);
    background.querySelectorAll("img").forEach((image) => image.addEventListener("load", update, { once: false }));
    update();
    window.addEventListener("resize", update);
  });
  for (const spec of WIDGETS) {
    const host = document.querySelector("[data-ws-widget-index=\"" + spec.index + "\"]");
    if (!host) continue;
    try {
      const module = await import(spec.url);
      const factory = module[spec.export];
      if (typeof factory !== "function") throw new Error("Missing widget export " + spec.export);
      const element = await factory({ ...spec.props, widgetId: spec.id });
      if (!(element instanceof Node)) throw new Error("Widget factory must return a DOM node");
      host.replaceWith(element);
    } catch (error) {
      host.dataset.webskinCompilerError = String(error?.message || error);
      console.error("Declarative widget failed", spec.id, error);
    }
  }
};

mount();
`;

const renderIndex = (theme, cssPath, runtimePath) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(theme.name)}</title>
    <link rel="stylesheet" href="./${escapeHtml(cssPath)}" />
${(theme.files.styles || []).map((path) => `    <link rel="stylesheet" href="./${escapeHtml(path)}" />`).join("\n")}
  </head>
  <body>
    ${theme.__markup}
    <script type="module" src="./${escapeHtml(runtimePath)}"></script>
  </body>
</html>
`;

const renderNode = (node, context) => {
  const { themeClass, scenePath, sources, widgets, assets, cssWarnings } = context;
  const id = escapeHtml(node.id);
  const token = escapeCssIdentifier(node.id);
  const classes = [`${themeClass}__node`, `${themeClass}__node--${token}`];
  if (node.className) classes.push(node.className);
  const attrs = [`data-ws-node="${id}"`];
  if (node.styleRef) attrs.push(`data-ws-style-ref="${escapeHtml(node.styleRef)}"`);
  const style = baseNodeStyle(node);

  if (node.kind === "layer") {
    style.zIndex = Number.isInteger(node.zIndex) ? node.zIndex : 0;
    style.position = "absolute";
    style.inset = "0";
    return `<div ${attrs.join(" ")} class="${classes.join(" ")}" style="${styleText(style)}"><div class="${themeClass}__layer-content">${renderNode(node.content, context)}</div></div>`;
  }
  if (node.kind === "stack") {
    style.position = "relative";
    style.width ||= "100%";
    style.height ||= "100%";
    const layers = [...(node.layers || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    return `<div ${attrs.join(" ")} class="${classes.join(" ")} ${themeClass}__stack" style="${styleText(style)}">${layers.map((child) => renderNode(child, context)).join("")}</div>`;
  }
  if (node.kind === "layout") {
    Object.assign(style, layoutStyle(node.layout));
    return `<div ${attrs.join(" ")} class="${classes.join(" ")} ${themeClass}__layout" style="${styleText(style)}">${node.children.map((child) => renderNode(child, context)).join("")}</div>`;
  }
  if (node.kind === "asset") {
    const path = resolvePath(scenePath, node.src);
    assets.add(path);
    const src = `./${escapeHtml(path)}`;
    const fit = node.fit || "contain";
    if (node.media === "video") {
      style.objectFit = fit;
      return `<video ${attrs.join(" ")} class="${classes.join(" ")}" style="${styleText(style)}" src="${src}" autoplay muted loop playsinline></video>`;
    }
    style.objectFit = fit;
    style.display ||= "block";
    return `<img ${attrs.join(" ")} class="${classes.join(" ")}" style="${styleText(style)}" src="${src}" alt="${escapeHtml(node.alt || "")}" />`;
  }
  if (node.kind === "widget" || node.kind === "component") {
    const index = widgets.length;
    widgets.push({ index, id: node.id, url: `/common/${node.module.path}`, export: node.module.export, props: node.props || {} });
    return `<div ${attrs.join(" ")} data-ws-widget-index="${index}" class="${classes.join(" ")}" style="${styleText(style)}"></div>`;
  }
  cssWarnings.push(`Unsupported node omitted: ${node.kind}`);
  return "";
};

const renderBackground = (background, scenePath, themeClass, assets) => {
  const composition = background.composition;
  const mainPath = resolvePath(scenePath, composition.main.src);
  assets.add(mainPath);
  const overlays = (composition.overlays || []).map((overlay) => {
    const path = resolvePath(scenePath, overlay.src);
    assets.add(path);
    return `<img data-ws-background-overlay src="./${escapeHtml(path)}" data-ws-overlay="${escapeHtml(JSON.stringify(overlay))}" alt="" />`;
  }).join("");
  return `<div data-ws-node="background" data-ws-background data-ws-composition="${escapeHtml(JSON.stringify({
    mode: composition.mode,
    anchor: composition.anchor,
  }))}" class="${themeClass}__background"><img data-ws-background-main src="./${escapeHtml(mainPath)}" alt="" />${overlays}</div>`;
};

const generatedCss = (theme, themeClass) => {
  const viewport = theme.viewport;
  const overflow = viewport.overflow === "scroll" ? "auto" : viewport.overflow;
  const dimensions = viewport.fit === "fixed"
    ? `width:${viewport.designSize.width}px;height:${viewport.designSize.height}px;`
    : "width:100%;height:100%;";
  return `html,body{width:100%;height:100%;margin:0;}body{overflow:${overflow};}${themeClass}__scene{position:relative;${dimensions}overflow:${overflow};isolation:isolate;}${themeClass}__background{position:absolute;inset:0;overflow:hidden;z-index:0;}${themeClass}__background img{position:absolute;max-width:none;transform-origin:center center;}${themeClass}__node{box-sizing:border-box;min-width:0;min-height:0;}${themeClass}__layer-content{position:relative;width:100%;height:100%;}${themeClass}__layout{position:relative;}${themeClass}__stack{position:relative;}`;
};

const buildPackage = async (theme, sceneInfo, sources, diagnostics) => {
  const themeClass = `ws-${escapeCssIdentifier(theme.id)}`;
  const widgets = [];
  const assets = new Set(sceneInfo.assets);
  const cssWarnings = [];
  const context = { themeClass, scenePath: theme.scenePath, sources, widgets, assets, cssWarnings };
  const background = renderBackground(sceneInfo.scene.root.background, theme.scenePath, themeClass, assets);
  const layers = [...sceneInfo.scene.root.layers].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  const markup = `<main data-ws-scene="root" class="${themeClass}__scene">${background}${layers.map((layer) => renderNode(layer, context)).join("")}</main>`;
  for (const text of cssWarnings) warning(diagnostics, "WS-COMPILER-WARNING", text, theme.scenePath);

  const generatedCssPath = "generated/theme.css";
  const runtimePath = "generated/runtime.js";
  const output = [
    makeCompiledFile("index.html", renderIndex({ ...theme, __markup: markup }, generatedCssPath, runtimePath), "text/html"),
    makeCompiledFile("metadata.json", JSON.stringify({
      id: theme.id,
      name: theme.name,
      type: "declarative",
      schemaVersion: theme.schemaVersion,
      entry: "index.html",
      viewport: theme.viewport,
      screenSupport: theme.screenSupport,
      dependencies: sceneInfo.dependencies,
      compiler: "declarative-basic-1",
    }, null, 2) + "\n", "application/json"),
    makeCompiledFile(generatedCssPath, generatedCss(theme, themeClass), "text/css"),
    makeCompiledFile(runtimePath, renderCompilerRuntime(widgets), "text/javascript"),
  ];

  for (const path of assets) output.push(makeCompiledFile(path, sources.get(path), typeForPath(path)));
  for (const style of theme.files.styles || []) {
    try {
      const path = resolvePath("theme.json", style);
      if (!sources.has(path)) {
        error(diagnostics, "WS-MISSING-FILE", `Stylesheet does not exist: ${path}`, "theme.json", "/files/styles");
      } else output.push(makeCompiledFile(path, sources.get(path), "text/css"));
    } catch (validationError) {
      error(diagnostics, "WS-UNSAFE-PATH", validationError.message, "theme.json", "/files/styles");
    }
  }
  return output;
};

export async function compileDeclarativeTheme(input) {
  const diagnostics = [];
  const sources = await loadSources(input, diagnostics);
  const theme = await parseJson(sources, "theme.json", diagnostics);
  const validatedTheme = theme ? validateTheme(theme, diagnostics, sources) : null;
  let sceneInfo = null;
  if (validatedTheme?.scenePath) {
    const scene = await parseJson(sources, validatedTheme.scenePath, diagnostics);
    sceneInfo = scene ? validateScene(scene, diagnostics, sources, validatedTheme.scenePath) : null;
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error") || !validatedTheme || !sceneInfo) {
    return { ok: false, files: [], diagnostics, themeId: validatedTheme?.id };
  }

  const files = await buildPackage(validatedTheme, sceneInfo, sources, diagnostics);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { ok: false, files: [], diagnostics, themeId: validatedTheme.id };
  }
  return {
    ok: true,
    themeId: validatedTheme.id,
    metadata: JSON.parse(await files.find((file) => file.path === "metadata.json").blob.text()),
    files,
    dependencies: sceneInfo.dependencies,
    diagnostics,
  };
}

export function appendCompiledFiles(formData, compilation, fieldName = "files") {
  if (!compilation?.ok) throw new TypeError("Cannot append an unsuccessful compilation");
  for (const file of compilation.files) formData.append(fieldName, file.file, file.path);
  return formData;
}

export function compiledFilesByPath(compilation) {
  if (!compilation?.ok) return new Map();
  return new Map(compilation.files.map((file) => [file.path, file.file]));
}
