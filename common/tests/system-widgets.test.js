import assert from "node:assert/strict";
import test from "node:test";

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.className = "";
    this.textContent = "";
  }

  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = String(value); }

  matches(selector) {
    const match = selector.match(/^\[data-webskin-system-part="([^"]+)"\]$/);
    return Boolean(match && this.dataset.webskinSystemPart === match[1]);
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (child instanceof FakeElement) {
          if (child.matches(selector)) matches.push(child);
          visit(child);
        }
      }
    };
    visit(this);
    return matches;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

const snapshot = {
  cpu: {
    utilization: { available: true, overall: 12.5, per_core: [10, 20] },
    cores: { physical: 2, logical: 4 },
    frequencies: {
      available: true,
      current_mhz: 2400,
      minimum_mhz: 800,
      maximum_mhz: 4200,
      per_core: [{ current_mhz: 2300 }, { current_mhz: 2500 }],
    },
    telemetry: { interrupts: 10, system_calls: 20, context_switches: 30 },
    load_average: { one_minute: 0.1, five_minutes: 0.2, fifteen_minutes: 0.3 },
  },
  memory: {
    virtual: { total_bytes: 100, available_bytes: 60, used_bytes: 40, free_bytes: 50, percent: 40 },
    swap: { total_bytes: 200, used_bytes: 20, free_bytes: 180, percent: 10 },
  },
  disks: {
    partitions: [{ mount_point: "C:\\", filesystem: "NTFS", mount_options: "rw" }],
    usage: [{ mount_point: "C:\\", total_bytes: 1000, used_bytes: 400, free_bytes: 600, percent: 40 }],
    io: { read_count: 1, write_count: 2, read_bytes: 3, write_bytes: 4, read_time_ms: 5, write_time_ms: 6, busy_time_ms: 7 },
  },
  network: { bytes_sent: 1, bytes_received: 2, packets_dropped: 3, transmission_errors: 4 },
  sensors: {
    readings: [{ id: "sensor-1", name: "CPU Package", value: 47.5, unit: "°C", minimum: 40, maximum: 80, critical: 95 }],
    temperatures: [],
    fans: [],
  },
};

const installDom = () => {
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    createTextNode: (text) => ({ textContent: String(text) }),
  };
  globalThis.window = { setInterval: () => 1, clearInterval: () => {} };
  globalThis.fetch = async () => ({ ok: true, json: async () => snapshot });
};

const metricRows = (element) => {
  const rows = [];
  const visit = (node) => {
    for (const child of node.children ?? []) {
      if (child instanceof FakeElement) {
        if (String(child.dataset.webskinSystemPart ?? "").endsWith("-row")) rows.push(child);
        visit(child);
      }
    }
  };
  visit(element);
  return rows;
};

const rowText = (row) => row.children.map((child) => child.textContent ?? "").join("");

let widgets;
test.before(async () => {
  installDom();
  widgets = await import("../src/widgets/system/index.js");
});

const scalarCases = [
  ["createCpuUtilization", [], {}], ["createCpuUtilization", ["core", { core: 0 }], {}],
  ["createCpuCoreCount", [], {}], ["createCpuCoreCount", ["logical"], {}],
  ["createCpuFrequency", [{ core: 0 }], {}], ["createCpuFrequency", ["current"], {}], ["createCpuFrequency", ["max"], {}], ["createCpuFrequency", ["min"], {}],
  ["createCpuTelemetry", [], {}], ["createCpuTelemetry", ["system-calls"], {}], ["createCpuTelemetry", ["context-switches"], {}],
  ["createCpuLoadAverage", [], {}], ["createCpuLoadAverage", ["five-minutes"], {}], ["createCpuLoadAverage", ["fifteen-minutes"], {}],
  ["createMemory", [], {}], ["createMemory", ["total"], {}], ["createMemory", ["available"], {}], ["createMemory", ["free"], {}], ["createMemory", ["percent"], {}],
  ["createSwap", [], {}], ["createSwap", ["total"], {}], ["createSwap", ["free"], {}], ["createSwap", ["percent"], {}],
  ["createDiskIo", [], {}], ["createDiskIo", ["read", "count"], {}], ["createDiskIo", ["write", "bytes"], {}], ["createDiskIo", ["write", "time"], {}], ["createDiskIo", ["busy", "time"], {}],
  ["createNetworkTelemetry", [], {}], ["createNetworkTelemetry", ["bytes-received"], {}], ["createNetworkTelemetry", ["packets-dropped"], {}], ["createNetworkTelemetry", ["transmission-errors"], {}],
  ["createDiskPartition", [{ mountPoint: "C:\\" }], {}], ["createDiskPartition", ["filesystem", { mountPoint: "C:\\" }], {}], ["createDiskPartition", ["mount-options", { mountPoint: "C:\\" }], {}],
  ["createDiskUsage", [{ mountPoint: "C:\\" }], {}], ["createDiskUsage", ["mount-point", { mountPoint: "C:\\" }], {}], ["createDiskUsage", ["total", { mountPoint: "C:\\" }], {}], ["createDiskUsage", ["used", { mountPoint: "C:\\" }], {}], ["createDiskUsage", ["free", { mountPoint: "C:\\" }], {}],
  ["createHardwareSensor", [{ sensorId: "sensor-1" }], {}], ["createHardwareSensor", ["name", { sensorId: "sensor-1" }], {}], ["createHardwareSensor", ["minimum", { sensorId: "sensor-1" }], {}], ["createHardwareSensor", ["maximum", { sensorId: "sensor-1" }], {}], ["createHardwareSensor", ["critical", { sensorId: "sensor-1" }], {}],
];

test("every family variant renders exactly one metric row", async () => {
  for (const [name, args] of scalarCases) {
    const element = widgets[name](...args);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(metricRows(element).length, 1, `${name} ${JSON.stringify(args)}`);
  }
});

test("variant factories preserve formatting and options-object defaults", async () => {
  const frequency = widgets.createCpuFrequency({ core: 0, format: "{label}: {value}{unit}" });
  const memory = widgets.createMemory("used", { format: "{label}: {value} {unit}" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(rowText(metricRows(frequency)[0]), /Core 1: 2,300MHz/);
  assert.match(rowText(metricRows(memory)[0]), /Used: 40 B/);
});

test("disk I/O validates its two selectors", () => {
  assert.doesNotThrow(() => widgets.createDiskIo());
  assert.doesNotThrow(() => widgets.createDiskIo("busy", "time"));
  assert.throws(() => widgets.createDiskIo("busy", "bytes"), /Unsupported disk I\/O/);
  assert.throws(() => widgets.createDiskIo("read", "unknown"), /Unsupported disk I\/O/);
});

test("required selectors and variants are validated", () => {
  assert.throws(() => widgets.createCpuFrequency(), /core/);
  assert.throws(() => widgets.createCpuFrequency("unknown", { core: 0 }), /Unsupported/);
  assert.throws(() => widgets.createCpuUtilization("core"), /core/);
  assert.throws(() => widgets.createDiskUsage(), /mountPoint/);
  assert.throws(() => widgets.createHardwareSensor({ sensorId: "" }), /sensorId/);
});

test("missing selected records render Unavailable without creating a list", async () => {
  const element = widgets.createDiskUsage({ mountPoint: "D:\\" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(rowText(metricRows(element)[0]), /Unavailable/);
  assert.equal(element.querySelectorAll('[data-webskin-system-part="usage"]').length, 0);
});

test("explicit list widgets retain multi-value rendering", async () => {
  const canonical = widgets.createCpuUtilizationList();
  const legacy = widgets.createMemoryList();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(canonical.querySelectorAll('[data-webskin-system-part="core-0-row"]').length, 1);
  assert.equal(canonical.querySelectorAll('[data-webskin-system-part="core-1-row"]').length, 1);
  assert.equal(legacy.querySelectorAll('[data-webskin-system-part="total-row"]').length, 1);
  assert.equal(legacy.querySelectorAll('[data-webskin-system-part="percent-row"]').length, 1);
});
