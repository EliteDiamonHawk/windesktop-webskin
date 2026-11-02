import type { LayoutDomOptions, LayoutInput, LayoutResult, LayoutWrapper } from "./types.js";
import { childGeometry, validateInput } from "./internal/geometry.js";
import { createLayoutWrapper } from "./wrapper.js";

export type ScrollOptions = LayoutDomOptions & {
  direction?: "horizontal" | "vertical" | "both";
  scrollbar?: "auto" | "scroll" | "hidden";
  clip?: boolean;
  initialScrollLeft?: number;
  initialScrollTop?: number;
};

export type ScrollDescriptor = LayoutWrapper & {
  createElement: () => HTMLDivElement;
};

const overflowValue = (scrollbar: ScrollOptions["scrollbar"]) => scrollbar ?? "auto";

export function createScroll(options: ScrollOptions = {}): ScrollDescriptor {
  const direction = options.direction ?? "vertical";
  const wrapper = createLayoutWrapper("scroll", options, (input: LayoutInput): LayoutResult => {
      validateInput(input);
      return Object.fromEntries(input.children.map((child) => [child.id, childGeometry(child)]));
    }, {
      container: () => {
        const scrollbar = overflowValue(options.scrollbar);
        return {
          overflowX: direction === "vertical" ? "hidden" : scrollbar,
          overflowY: direction === "horizontal" ? "hidden" : scrollbar,
          clipPath: options.clip === false ? undefined : "inset(0)",
        };
      },
      onApply: (element) => {
        if (options.initialScrollLeft !== undefined) element.scrollLeft = options.initialScrollLeft;
        if (options.initialScrollTop !== undefined) element.scrollTop = options.initialScrollTop;
      },
    }) as ScrollDescriptor;
  wrapper.createElement = () => wrapper.element;
  return wrapper;
}

