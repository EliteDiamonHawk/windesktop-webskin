import assert from "node:assert/strict";
import test from "node:test";

import {
  createLocalDate,
  getMonthGrid,
  getRollingMonthGrid,
} from "../src/widgets/time/calendar-data.js";

const cellCount = (date, maxWeeks) => getMonthGrid(date, 0, maxWeeks).length;

test("month grids render exactly five or six requested weeks", () => {
  const naturallyFiveWeekMonth = createLocalDate(2026, 3, 15);

  assert.equal(cellCount(naturallyFiveWeekMonth, 5), 35);
  assert.equal(cellCount(naturallyFiveWeekMonth, 6), 42);
});

test("six-week months can be constrained to five rows or rendered fully", () => {
  const naturallySixWeekMonth = createLocalDate(2026, 7, 15);

  assert.equal(cellCount(naturallySixWeekMonth, 5), 35);
  assert.equal(cellCount(naturallySixWeekMonth, 6), 42);
});

test("locked month grids retain the requested row count", () => {
  const date = createLocalDate(2026, 3, 15);

  assert.equal(getRollingMonthGrid(date, 0, { y: 2 }, 5).cells.length, 35);
  assert.equal(getRollingMonthGrid(date, 0, { y: 2 }, 6).cells.length, 42);
});
