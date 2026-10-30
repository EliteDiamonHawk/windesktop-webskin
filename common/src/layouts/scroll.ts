import type { LayoutDescriptor, LayoutInput, LayoutResult } from "./types.js";
import { childGeometry, createDescriptor, validateInput } from "./internal/geometry.js";

export type ScrollOptions = {
  direction?: "horizontal" | "vertical" | "both";
  scrollbar?: "auto" | "scroll" | "hidden";
  clip?: boolean;
  initialScrollLeft?: number;
  initialScrollTop?: number;
};

export type ScrollDescriptor = LayoutDescriptor & {
  createElement: () => HTMLDivElement;
  apply: (element: HTMLElement) => void;
};

const overflowValue = (scrollbar: ScrollOptions["scrollbar"]) => scrollbar ?? "auto";

export function createScroll(options: ScrollOptions = {}): ScrollDescriptor {
  const direction = options.direction ?? "vertical";
  const descriptor: ScrollDescriptor = {
    type: "scroll",
    calculate: (input: LayoutInput): LayoutResult => {
      validateInput(input);
      return Object.fromEntries(input.children.map((child) => [child.id, childGeometry(child)]));
    },
    apply: (element) => {
    const scrollbar = overflowValue(options.scrollbar);
    element.style.overflowX = direction === "vertical" ? "hidden" : scrollbar;
    element.style.overflowY = direction === "horizontal" ? "hidden" : scrollbar;
    if (options.clip !== false) element.style.clipPath = "inset(0)";
    else element.style.removeProperty("clip-path");
    if (options.initialScrollLeft !== undefined) element.scrollLeft = options.initialScrollLeft;
    if (options.initialScrollTop !== undefined) element.scrollTop = options.initialScrollTop;
    },
    createElement: () => {
      if (typeof document === "undefined") throw new Error("Scroll elements require a document");
      const element = document.createElement("div");
      element.dataset.webskinLayout = "scroll";
      descriptor.apply(element);
      return element;
    },
  };
  return descriptor;
}

