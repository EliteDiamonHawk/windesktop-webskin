export type StaticImageLayer = {
  src: string;
  x: number;
  y: number;
  scale?: number;
  anchorX?: number;
  anchorY?: number;
  rotation?: number;
  opacity?: number;
  flipX?: boolean;
  flipY?: boolean;
};

export type StaticImageCompositionOptions = {
  frame: {
    width: number;
    height: number;
  };
  main: {
    src: string;
  };
  images?: StaticImageLayer[];
  className?: string;
  alt?: string;
  onError?: (
    error: unknown,
    details: { source?: string; layerIndex?: number },
  ) => void;
};

export type StaticImageCompositionElement = HTMLImageElement & {
  ready: Promise<boolean>;
  update: (options: StaticImageCompositionOptions) => Promise<boolean>;
  destroy: () => void;
};

type NormalizedLayer = Required<StaticImageLayer>;

type NormalizedOptions = {
  frame: { width: number; height: number };
  main: { src: string };
  images: NormalizedLayer[];
  className: string;
  alt: string;
  onError?: StaticImageCompositionOptions["onError"];
  signature: string;
};

class CompositionError extends Error {
  source?: string;
  layerIndex?: number;

  constructor(error: unknown, details: { source?: string; layerIndex?: number }) {
    super(error instanceof Error ? error.message : String(error));
    this.name = "StaticImageCompositionError";
    this.source = details.source;
    this.layerIndex = details.layerIndex;
    this.cause = error;
  }
}

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === "number" && Number.isFinite(value)
);

const requireString = (value: unknown, name: string) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
};

const requirePositiveInteger = (value: unknown, name: string) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value as number;
};

const requireFinite = (value: unknown, name: string) => {
  if (!isFiniteNumber(value)) throw new TypeError(`${name} must be finite`);
  return value;
};

const requireRange = (value: unknown, name: string, minimum: number, maximum: number) => {
  requireFinite(value, name);
  if (value < minimum || value > maximum) {
    throw new RangeError(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value as number;
};

const normalizeOptions = (options: StaticImageCompositionOptions): NormalizedOptions => {
  if (!options || typeof options !== "object") {
    throw new TypeError("Static image composition options are required");
  }

  const width = requirePositiveInteger(options.frame?.width, "frame.width");
  const height = requirePositiveInteger(options.frame?.height, "frame.height");
  const mainSrc = requireString(options.main?.src, "main.src");
  const images = (options.images ?? []).map((layer, index) => {
    if (!layer || typeof layer !== "object") {
      throw new TypeError(`images[${index}] must be an object`);
    }

    return {
      src: requireString(layer.src, `images[${index}].src`),
      x: requireFinite(layer.x, `images[${index}].x`),
      y: requireFinite(layer.y, `images[${index}].y`),
      scale: requireFinite(layer.scale ?? 1, `images[${index}].scale`),
      anchorX: requireRange(layer.anchorX ?? 0.5, `images[${index}].anchorX`, 0, 1),
      anchorY: requireRange(layer.anchorY ?? 0.5, `images[${index}].anchorY`, 0, 1),
      rotation: requireFinite(layer.rotation ?? 0, `images[${index}].rotation`),
      opacity: requireRange(layer.opacity ?? 1, `images[${index}].opacity`, 0, 1),
      flipX: Boolean(layer.flipX),
      flipY: Boolean(layer.flipY),
    };
  });

  for (const [index, layer] of images.entries()) {
    if (layer.scale <= 0) throw new RangeError(`images[${index}].scale must be greater than 0`);
  }

  const signature = JSON.stringify({
    frame: { width, height },
    main: { src: mainSrc },
    images,
  });

  return {
    frame: { width, height },
    main: { src: mainSrc },
    images,
    className: options.className ?? "",
    alt: options.alt ?? "",
    onError: options.onError,
    signature,
  };
};

const loadImage = (
  src: string,
  cache: Map<string, Promise<HTMLImageElement>>,
  pendingImages: Set<HTMLImageElement>,
) => {
  const existing = cache.get(src);
  if (existing) return existing;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    pendingImages.add(image);
    let settled = false;

    const finish = () => {
      if (settled) return;
      if (!image.naturalWidth || !image.naturalHeight) {
        fail(new Error(`Image has no intrinsic dimensions: ${src}`));
        return;
      }
      settled = true;
      pendingImages.delete(image);
      image.onload = null;
      image.onerror = null;
      resolve(image);
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      pendingImages.delete(image);
      image.onload = null;
      image.onerror = null;
      reject(error instanceof Error ? error : new Error(`Unable to load image: ${src}`));
    };

    image.decoding = "async";
    image.onload = finish;
    image.onerror = () => fail(new Error(`Unable to load image: ${src}`));
    image.src = src;

    if (image.complete && image.naturalWidth && image.naturalHeight) finish();
    if (typeof image.decode === "function") {
      void image.decode().then(finish).catch(() => {});
    }
  });

  cache.set(src, promise);
  promise.catch(() => {
    if (cache.get(src) === promise) cache.delete(src);
  });
  return promise;
};

const canvasToBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  if (typeof canvas.toBlob !== "function") {
    reject(new Error("Canvas export is not supported"));
    return;
  }

  try {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas export returned no image"));
    }, "image/png");
  } catch (error) {
    reject(error);
  }
});

const compose = async (
  options: NormalizedOptions,
  cache: Map<string, Promise<HTMLImageElement>>,
  pendingImages: Set<HTMLImageElement>,
) => {
  const mainPromise = loadImage(options.main.src, cache, pendingImages).catch((error) => {
    throw new CompositionError(error, { source: options.main.src });
  });
  const layerPromises = options.images.map((layer, layerIndex) => (
    loadImage(layer.src, cache, pendingImages).catch((error) => {
      throw new CompositionError(error, { source: layer.src, layerIndex });
    })
  ));
  const [mainImage, ...layerImages] = await Promise.all([mainPromise, ...layerPromises]);

  const canvas = document.createElement("canvas");
  canvas.width = options.frame.width;
  canvas.height = options.frame.height;

  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas context is not supported");

    const mainWidth = mainImage.naturalWidth;
    const mainHeight = mainImage.naturalHeight;
    const fitScale = Math.max(
      options.frame.width / mainWidth,
      options.frame.height / mainHeight,
    );
    const drawnWidth = mainWidth * fitScale;
    const drawnHeight = mainHeight * fitScale;
    const offsetX = (options.frame.width - drawnWidth) / 2;
    const offsetY = (options.frame.height - drawnHeight) / 2;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(mainImage, offsetX, offsetY, drawnWidth, drawnHeight);

    for (const [index, layer] of options.images.entries()) {
      const image = layerImages[index];
      context.save();
      context.globalAlpha = layer.opacity;
      context.translate(
        offsetX + layer.x * fitScale,
        offsetY + layer.y * fitScale,
      );
      context.rotate((layer.rotation * Math.PI) / 180);
      context.scale(
        fitScale * layer.scale * (layer.flipX ? -1 : 1),
        fitScale * layer.scale * (layer.flipY ? -1 : 1),
      );
      context.drawImage(
        image,
        -layer.anchorX * image.naturalWidth,
        -layer.anchorY * image.naturalHeight,
      );
      context.restore();
    }

    return await canvasToBlob(canvas);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
};

const notifyError = (
  callback: NormalizedOptions["onError"],
  error: unknown,
) => {
  if (!callback) return;
  try {
    callback(error, {
      source: error instanceof CompositionError ? error.source : undefined,
      layerIndex: error instanceof CompositionError ? error.layerIndex : undefined,
    });
  } catch {}
};

const objectUrlSupported = () => (
  typeof URL !== "undefined"
  && typeof URL.createObjectURL === "function"
  && typeof URL.revokeObjectURL === "function"
);

export function createStaticImageComposition(
  initialOptions: StaticImageCompositionOptions,
): StaticImageCompositionElement {
  let options = normalizeOptions(initialOptions);
  let currentUrl = "";
  let generation = 0;
  let destroyed = false;
  let readyPromise: Promise<boolean>;
  const cache = new Map<string, Promise<HTMLImageElement>>();
  const pendingImages = new Set<HTMLImageElement>();
  const element = document.createElement("img") as StaticImageCompositionElement;

  element.dataset.webskinLayout = "static-image-composition";

  const applyPresentation = (nextOptions: NormalizedOptions) => {
    element.className = nextOptions.className;
    element.alt = nextOptions.alt;
    element.width = nextOptions.frame.width;
    element.height = nextOptions.frame.height;
    element.setAttribute("width", String(nextOptions.frame.width));
    element.setAttribute("height", String(nextOptions.frame.height));
  };

  const startComposition = (nextOptions: NormalizedOptions) => {
    const currentGeneration = ++generation;
    readyPromise = compose(nextOptions, cache, pendingImages).then((blob) => {
      if (destroyed || currentGeneration !== generation) return false;
      if (!objectUrlSupported()) {
        throw new Error("Object URLs are not supported");
      }

      const nextUrl = URL.createObjectURL(blob);
      if (destroyed || currentGeneration !== generation) {
        URL.revokeObjectURL(nextUrl);
        return false;
      }

      const previousUrl = currentUrl;
      currentUrl = nextUrl;
      element.src = nextUrl;
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      return true;
    }).catch((error) => {
      if (!destroyed && currentGeneration === generation) notifyError(nextOptions.onError, error);
      return false;
    });
    return readyPromise;
  };

  const update = (nextOptions: StaticImageCompositionOptions) => {
    if (destroyed) return Promise.resolve(false);
    const normalized = normalizeOptions(nextOptions);
    applyPresentation(normalized);
    const changed = normalized.signature !== options.signature;
    options = normalized;
    return changed ? startComposition(normalized) : readyPromise;
  };

  applyPresentation(options);
  Object.defineProperties(element, {
    ready: {
      configurable: false,
      enumerable: true,
      get: () => readyPromise,
    },
    update: {
      configurable: false,
      enumerable: true,
      value: update,
    },
    destroy: {
      configurable: false,
      enumerable: true,
      value: () => {
        if (destroyed) return;
        destroyed = true;
        generation += 1;
        for (const image of pendingImages) {
          image.onload = null;
          image.onerror = null;
          image.src = "";
        }
        pendingImages.clear();
        cache.clear();
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
          currentUrl = "";
        }
        element.removeAttribute("src");
      },
    },
  });

  startComposition(options);
  return element;
}
