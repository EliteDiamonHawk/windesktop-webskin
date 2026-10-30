import type { Alignment, LayoutChild, LayoutDescriptor, LayoutInput, LayoutResult, Padding } from "./types.js";
import {
  alignOffset,
  constrainedSize,
  createDescriptor,
  innerBounds,
  integer,
  normalizePadding,
  nonNegative,
  setResult,
  validateInput,
} from "./internal/geometry.js";

export type GridOptions = {
  columns?: number;
  rows?: number;
  cellWidth?: number;
  cellHeight?: number;
  rowGap?: number;
  columnGap?: number;
  gap?: number;
  padding?: Padding;
  cellSizing?: "stretch" | "natural";
  horizontalAlign?: "start" | "center" | "end" | "stretch";
  verticalAlign?: "start" | "center" | "end" | "stretch";
};

type Cell = { row: number; column: number; rowSpan: number; columnSpan: number };

const occupied = (cells: Cell[], row: number, column: number, rowSpan: number, columnSpan: number) => cells.some((cell) => (
  row < cell.row + cell.rowSpan
  && row + rowSpan > cell.row
  && column < cell.column + cell.columnSpan
  && column + columnSpan > cell.column
));

const calculate = (input: LayoutInput, options: GridOptions): LayoutResult => {
  validateInput(input);
  const padding = normalizePadding(options.padding);
  const bounds = innerBounds(input, padding);
  const rowGap = nonNegative(options.rowGap ?? options.gap ?? 0, "rowGap");
  const columnGap = nonNegative(options.columnGap ?? options.gap ?? 0, "columnGap");
  const columns = options.columns === undefined ? undefined : integer(options.columns, "columns", 1);
  const rows = options.rows === undefined ? undefined : integer(options.rows, "rows", 1);
  const cellWidth = options.cellWidth === undefined ? undefined : nonNegative(options.cellWidth, "cellWidth");
  const cellHeight = options.cellHeight === undefined ? undefined : nonNegative(options.cellHeight, "cellHeight");
  const columnCount = columns ?? (rows ? Math.max(1, Math.ceil(input.children.length / rows)) : Math.max(1, Math.floor((bounds.width + columnGap) / ((cellWidth ?? 1) + columnGap))));
  let rowCount = rows ?? Math.max(1, Math.ceil(input.children.length / columnCount));
  const naturalColumns = Array.from({ length: columnCount }, () => 0);
  const naturalRows: number[] = Array.from({ length: rowCount }, () => 0);
  const cells: Cell[] = [];
  const childCells = new Map<string, Cell>();

  for (const child of input.children) {
    const rowSpan = integer(child.rowSpan ?? 1, `${child.id}.rowSpan`, 1);
    const columnSpan = integer(child.columnSpan ?? 1, `${child.id}.columnSpan`, 1);
    const requestedRow = child.gridRow === undefined ? undefined : integer(child.gridRow, `${child.id}.gridRow`, 1) - 1;
    const requestedColumn = child.gridColumn === undefined ? undefined : integer(child.gridColumn, `${child.id}.gridColumn`, 1) - 1;
    let row = requestedRow;
    let column = requestedColumn;
    if (row === undefined || column === undefined) {
      row = 0;
      column = 0;
      while (occupied(cells, row, column, rowSpan, columnSpan)) {
        column += 1;
        if (column + columnSpan > columnCount) {
          column = 0;
          row += 1;
        }
      }
    }
    if (row + rowSpan > rowCount && rows === undefined) {
      while (rowCount < row + rowSpan) {
        rowCount += 1;
        naturalRows.push(0);
      }
    }
    if (row + rowSpan > rowCount || column + columnSpan > columnCount) {
      throw new RangeError(`grid placement for ${child.id} exceeds configured tracks`);
    }
    const cell = { row, column, rowSpan, columnSpan };
    cells.push(cell);
    childCells.set(child.id, cell);
    if (options.cellSizing === "natural") {
      naturalColumns[column] = Math.max(naturalColumns[column], child.width / columnSpan);
      naturalRows[row] = Math.max(naturalRows[row], child.height / rowSpan);
    }
  }

  const totalColumnGap = Math.max(0, columnCount - 1) * columnGap;
  const totalRowGap = Math.max(0, rowCount - 1) * rowGap;
  const columnsWidth = options.cellSizing === "natural"
    ? naturalColumns.map((value) => value || (bounds.width - totalColumnGap) / columnCount)
    : Array.from({ length: columnCount }, () => (bounds.width - totalColumnGap) / columnCount);
  const rowsHeight = options.cellSizing === "natural"
    ? naturalRows.map((value) => value || (bounds.height - totalRowGap) / rowCount)
    : Array.from({ length: rowCount }, () => (bounds.height - totalRowGap) / rowCount);
  const columnStarts = columnsWidth.map((_, index) => bounds.x + columnsWidth.slice(0, index).reduce((sum, value) => sum + value + columnGap, 0));
  const rowStarts = rowsHeight.map((_, index) => bounds.y + rowsHeight.slice(0, index).reduce((sum, value) => sum + value + rowGap, 0));
  const result: LayoutResult = {};

  for (const child of input.children) {
    const cell = childCells.get(child.id)!;
    const cellWidthValue = columnsWidth.slice(cell.column, cell.column + cell.columnSpan).reduce((sum, value) => sum + value, 0) + Math.max(0, cell.columnSpan - 1) * columnGap;
    const cellHeightValue = rowsHeight.slice(cell.row, cell.row + cell.rowSpan).reduce((sum, value) => sum + value, 0) + Math.max(0, cell.rowSpan - 1) * rowGap;
    const size = constrainedSize(
      child,
      options.horizontalAlign === "stretch" || options.cellSizing !== "natural" ? cellWidthValue : child.width,
      options.verticalAlign === "stretch" || options.cellSizing !== "natural" ? cellHeightValue : child.height,
    );
    setResult(result, child, {
      x: columnStarts[cell.column] + alignOffset(cellWidthValue, size.width, options.horizontalAlign ?? "stretch"),
      y: rowStarts[cell.row] + alignOffset(cellHeightValue, size.height, options.verticalAlign ?? "stretch"),
      width: size.width,
      height: size.height,
      zIndex: child.zIndex,
    });
  }
  return result;
};

export function createGrid(options: GridOptions = {}): LayoutDescriptor {
  return createDescriptor("grid", (input) => calculate(input, options));
}

