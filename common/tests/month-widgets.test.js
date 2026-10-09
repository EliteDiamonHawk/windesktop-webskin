import assert from "node:assert/strict";
import test from "node:test";

class FakeStyle {
  #values = new Map();

  setProperty(name, value) { this.#values.set(name, String(value)); }
  getPropertyValue(name) { return this.#values.get(name) ?? ""; }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.style = new FakeStyle();
    this.className = "";
    this.classList = {
      add: (...names) => {
        const current = new Set(this.className.split(/\s+/).filter(Boolean));
        names.forEach((name) => current.add(name));
        this.className = [...current].join(" ");
      },
    };
    this.textContent = "";
    this.id = "";
    this.dateTime = "";
  }

  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }

  querySelectorAll(selector) {
    const match = selector.match(/^\[data-webskin-calendar-(part|date)="([^"]+)"\]$/);
    const results = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (!(child instanceof FakeElement)) continue;
        if (match) {
          const value = match[1] === "part"
            ? child.dataset.webskinCalendarPart
            : child.dataset.webskinCalendarDate;
          if (value === match[2]) results.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return results;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

let activeInterval;
let clearedIntervals = [];
let baseDocument;
let baseWindow;

const installDom = () => {
  activeInterval = undefined;
  clearedIntervals = [];
  const head = new FakeElement("head");
  globalThis.document = {
    head,
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: (id) => head.children.find((child) => child.id === id) ?? null,
  };
  globalThis.window = {
    setInterval: (callback) => {
      activeInterval = callback;
      return 1;
    },
    clearInterval: (id) => clearedIntervals.push(id),
  };
};

let plain;
let prestyled;
test.before(async () => {
  baseDocument = globalThis.document;
  baseWindow = globalThis.window;
  installDom();
  plain = await import("../src/widgets/time/month-plain.js?month-widget-test");
  prestyled = await import("../src/widgets/time/month-prestyled.js?month-widget-test");
  globalThis.document = baseDocument;
  globalThis.window = baseWindow;
});

const withMonthDom = (callback) => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  installDom();
  try {
    return callback();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
};

const dateCells = (element) => element.querySelectorAll('[data-webskin-calendar-part="date-cell"]');

test("plain and pre-styled months render exact five- and six-row grids", () => {
  withMonthDom(() => {
    for (const createMonth of [plain.createMonth, prestyled.createMonth]) {
      const five = createMonth({ date: "2026-04-15", maxWeeks: 5 });
      const six = createMonth({ date: "2026-04-15", maxWeeks: 6 });

      assert.equal(dateCells(five).length, 35);
      assert.equal(dateCells(six).length, 42);
    }
  });
});

test("unlocked grids preserve exact height for natural five- and six-week months", () => {
  withMonthDom(() => {
    for (const createMonth of [plain.createMonth, prestyled.createMonth]) {
      assert.equal(dateCells(createMonth({ date: "2026-04-15", maxWeeks: 6 })).length, 42);
      assert.equal(dateCells(createMonth({ date: "2026-08-15", maxWeeks: 5 })).length, 35);
      assert.equal(dateCells(createMonth({ date: "2026-08-15", maxWeeks: 6 })).length, 42);
    }
  });
});

test("row and cell locks retain their requested positions and row counts", () => {
  withMonthDom(() => {
    for (const createMonth of [plain.createMonth, prestyled.createMonth]) {
      const rowLocked = createMonth({ date: "2026-04-15", maxWeeks: 5, lockDay: { y: 2 } });
      assert.equal(dateCells(rowLocked).length, 35);
      assert.equal(rowLocked.dataset.webskinCalendarLockY, "2");
      assert.equal(rowLocked.dataset.webskinCalendarLockX, undefined);

      const cellLocked = createMonth({ date: "2026-04-15", maxWeeks: 6, lockDay: { x: 3, y: 2 } });
      assert.equal(dateCells(cellLocked).length, 42);
      assert.equal(cellLocked.dataset.webskinCalendarLockY, "2");
      assert.equal(cellLocked.dataset.webskinCalendarLockX, "3");
    }
  });
});

test("month metadata and adjacent-day state remain stable", () => {
  withMonthDom(() => {
    const month = plain.createMonth({ date: "2026-04-15", weekStartsOn: 0, highlightDate: "2026-04-15" });
    assert.equal(month.dataset.webskinCalendarMonth, "2026-04");
    assert.equal(month.dataset.webskinCalendarMaxWeeks, "6");

    const headings = month.querySelectorAll('[data-webskin-calendar-part="weekday-heading"]');
    assert.equal(headings[0].dataset.webskinCalendarWeekday, "sunday");

    const leadingCell = month.querySelector('[data-webskin-calendar-date="2026-03-29"]');
    assert.equal(leadingCell.dataset.webskinCalendarInMonth, "false");
    assert.equal(leadingCell.dataset.webskinCalendarToday, "false");

    const highlightedCell = month.querySelector('[data-webskin-calendar-date="2026-04-15"]');
    assert.equal(highlightedCell.dataset.webskinCalendarInMonth, "true");
    assert.equal(highlightedCell.dataset.webskinCalendarToday, "true");
  });
});

test("date rollover updates existing cells and destroy clears the watcher", () => {
  withMonthDom(() => {
    const RealDate = globalThis.Date;
    let currentDate = "2026-04-15T12:00:00";
    class ControlledDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [currentDate])); }
      static now() { return new RealDate(currentDate).getTime(); }
    }

    globalThis.Date = ControlledDate;
    try {
      const month = plain.createMonth();
      const firstCell = dateCells(month)[0];
      assert.equal(month.dataset.webskinCalendarDate, "2026-04-15");

      currentDate = "2026-05-15T12:00:00";
      activeInterval();
      assert.equal(month.dataset.webskinCalendarDate, "2026-05-15");
      assert.equal(dateCells(month)[0], firstCell);

      month.destroy();
      assert.deepEqual(clearedIntervals, [1]);
    } finally {
      globalThis.Date = RealDate;
    }
  });
});
