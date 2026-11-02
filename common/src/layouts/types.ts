export type Axis = "horizontal" | "vertical";

export type HorizontalAlignment = "start" | "center" | "end" | "stretch";
export type VerticalAlignment = "start" | "center" | "end" | "stretch";
export type Alignment = HorizontalAlignment | VerticalAlignment;

export type Distribution =
  | "start"
  | "center"
  | "end"
  | "space-between"
  | "space-around"
  | "space-evenly";

export type Size = {
  width: number;
  height: number;
};

export type Geometry = Size & {
  x: number;
  y: number;
  zIndex?: number;
};

export type Padding = number | {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type OverlayPlacement =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export type DockRegion = "top" | "bottom" | "left" | "right" | "fill";

export type CanvasPosition = {
  x?: number;
  y?: number;
  right?: number;
  bottom?: number;
  centerX?: number;
  centerY?: number;
  percentX?: number;
  percentY?: number;
  anchorX?: number;
  anchorY?: number;
  width?: number;
  height?: number;
  zIndex?: number;
};

export type LayoutChild = {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  flex?: number;
  spacer?: boolean;
  gridRow?: number;
  gridColumn?: number;
  rowSpan?: number;
  columnSpan?: number;
  dock?: DockRegion;
  overlay?: OverlayPlacement;
  offsetX?: number;
  offsetY?: number;
  position?: CanvasPosition;
  zIndex?: number;
  layout?: LayoutDescriptor;
  children?: readonly LayoutChild[];
};

export type LayoutRenderable = HTMLElement | { element: HTMLElement };

export type LayoutChildOptions = Omit<LayoutChild, "id" | "width" | "height"> & Partial<Pick<LayoutChild, "width" | "height">>;

export type LayoutDomOptions = {
  element?: HTMLDivElement;
  className?: string;
};

export type LayoutInput = Size & {
  children: readonly LayoutChild[];
};

export type LayoutResult = Record<string, Geometry>;

export type LayoutDescriptor = {
  readonly type: string;
  calculate(input: LayoutInput): LayoutResult;
};

export type LayoutStyleMap = Record<string, string | number | undefined | null>;

export type LayoutStyleProvider = {
  getContainerStyles(): LayoutStyleMap;
  getChildStyles(options: LayoutChildOptions, index: number, id: string): LayoutStyleMap;
};

export type LayoutWrapper = LayoutDescriptor & LayoutStyleProvider & {
  readonly element: HTMLDivElement;
  mount(parent: Node): this;
  add(id: string, child: LayoutRenderable, options?: LayoutChildOptions): HTMLElement;
  setChildOptions(id: string, options: LayoutChildOptions): this;
  getChildOptions(id: string): LayoutChildOptions | undefined;
  remove(id: string): boolean;
  get(id: string): HTMLElement | undefined;
  children(): Map<string, HTMLElement>;
  apply(): this;
  applyGeometry(result: LayoutResult): this;
  dispose(): void;
};

export type SpacerSpec = Pick<LayoutChild, "flex" | "minWidth" | "maxWidth" | "minHeight" | "maxHeight"> & {
  spacer: true;
};

export type LayoutOptions = {
  padding?: Padding;
  gap?: number;
};

