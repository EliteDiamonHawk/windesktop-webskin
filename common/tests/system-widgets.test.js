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
    const part = selector.match(/^\[data-webskin-system-part="([^"]+)"\]$/);
    if (part) return this.dataset.webskinSystemPart === part[1];
    const formatPart = selector.match(/^\[data-webskin-system-format-part="([^"]+)"\]$/);
    return Boolean(formatPart && this.dataset.webskinSystemFormatPart === formatPart[1]);
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
    utilization: { overall: 12.5, per_core: [10, 20] },
    cores: { physical: 2, logical: 4 },
    frequencies: {
      current_mhz: 2400,
      minimum_mhz: 800,
      maximum_mhz: 4200,
      per_core: [
        { current_mhz: 2300, minimum_mhz: 800, maximum_mhz: 4200 },
        { current_mhz: 2500, minimum_mhz: 900, maximum_mhz: 4300 },
      ],
    },
    telemetry: { interrupts: 10, system_calls: 20, context_switches: 30 },
    load_average: { one_minute: 0.1, five_minutes: 0.2, fifteen_minutes: 0.3 },
  },
  memory: {
    virtual: { total_bytes: 4096, available_bytes: 2048, used_bytes: 2048, free_bytes: 1024, percent: 50 },
    swap: { total_bytes: 8192, used_bytes: 1024, free_bytes: 7168, percent: 12.5 },
  },
  disks: {
    partitions: [{ mount_point: "C:\\", filesystem: "NTFS", mount_options: "rw" }],
    usage: [{ mount_point: "C:\\", total_bytes: 1000, used_bytes: 400, free_bytes: 600, percent: 40 }],
    io: { read_count: 1, write_count: 2, read_bytes: 2048, write_bytes: 4096, read_time_ms: 5, write_time_ms: 6, busy_time_ms: 7 },
  },
  network: { bytes_sent: 1024, bytes_received: 2048, packets_dropped: 3, transmission_errors: 4 },
  sensors: {
    battery: { percent: 87.5, seconds_left: 3600, power_plugged: false },
    readings: [
      { id: "gpu/0/core", hardware_id: "gpu/0", hardware_name: "GPU", hardware_type: "gpu", name: "Core", type: "temperature", value: 47.5, minimum: 40, maximum: 80, critical: 95, unit: "°C" },
      { id: "gpu/0/hotspot", hardware_id: "gpu/0", hardware_name: "GPU", hardware_type: "gpu", name: "Hot Spot", type: "temperature", value: 60, critical: 100, unit: "°C" },
      { id: "gpu/0/fan", hardware_id: "gpu/0", hardware_name: "GPU", hardware_type: "gpu", name: "Fan", type: "fan", value: 1200, unit: "RPM" },
    ],
  },
};

let responseSnapshot = snapshot;
let requestUrls = [];
let timers = [];
let created = [];

const installDom = () => {
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    createTextNode: (text) => ({ textContent: String(text) }),
  };
  globalThis.window = {
    setInterval: (callback) => {
      timers.push(callback);
      return timers.length;
    },
    clearInterval: () => {},
  };
  globalThis.fetch = async (url) => {
    requestUrls.push(String(url));
    return { ok: true, json: async () => responseSnapshot };
  };
};

const textOf = (node) => (node instanceof FakeElement
  ? (node.children.length ? node.children.map((child) => textOf(child)).join("") : node.textContent)
  : node?.textContent ?? "");

const rowsText = (element) => [...element.querySelector('[data-webskin-system-part="content"]').children].map(textOf);
const waitForPoll = () => new Promise((resolve) => setImmediate(resolve));

let widgets;
test.before(async () => {
  installDom();
  widgets = await import("../src/widgets/system/index.js");
});

test.beforeEach(() => {
  responseSnapshot = snapshot;
  requestUrls = [];
  timers = [];
  created = [];
});

test.afterEach(() => {
  created.splice(0).forEach((element) => element.destroy?.());
});

test("formats dynamic values, preserves literals, and requests only referenced fields", async () => {
  const memory = widgets.createMemory({ format: "Used={used}\\nUsage {percent} %" });
  created.push(memory);
  assert.deepEqual(rowsText(memory), ["Used=-", "Usage - %"]);
  await waitForPoll();
  assert.deepEqual(rowsText(memory), ["Used=2", "Usage 50 %"]);
  assert.deepEqual(
    [...memory.querySelectorAll('[data-webskin-system-format-part="used"]')].map((part) => part.textContent),
    ["2"],
  );
  const fields = new URL(requestUrls[0], "http://localhost").searchParams.get("fields").split(",").sort();
  assert.deepEqual(fields, ["memory.virtual.percent", "memory.virtual.used_bytes"]);
});

test("coalesces widgets with the same endpoint and interval", async () => {
  const memory = widgets.createMemory({ format: "{used}" });
  const network = widgets.createNetworkTelemetry({ format: "{sent}" });
  created.push(memory, network);
  await waitForPoll();
  assert.equal(requestUrls.length, 1);
  const fields = new URL(requestUrls[0], "http://localhost").searchParams.get("fields").split(",").sort();
  assert.deepEqual(fields, ["memory.virtual.used_bytes", "network.bytes_sent"]);
});

test("renders CPU variants and limits", async () => {
  const overall = widgets.createCpuUtilization();
  const core = widgets.createCpuUtilization({ core: 1 });
  const list = widgets.createCpuUtilizationList({ limit: 1, zeroIndex: true });
  created.push(overall, core, list);
  await waitForPoll();
  assert.equal(rowsText(overall)[0], "12.5 %");
  assert.equal(rowsText(core)[0], "2: 20 %");
  assert.deepEqual(rowsText(list), ["Overall: 12.5 %", "Core 0: 10 %"]);
});

test("renders the canonical combined widgets", async () => {
  const counts = widgets.createCpuCoreCounts();
  const frequency = widgets.createCpuFrequency({ core: 0 });
  const telemetry = widgets.createCpuTelemetry();
  const load = widgets.createCpuLoadAverage();
  const swap = widgets.createSwapMemory();
  const disk = widgets.createDiskIo();
  const partitions = widgets.createDiskPartitions({ mountPoint: "C:\\" });
  created.push(counts, frequency, telemetry, load, swap, disk, partitions);
  await waitForPoll();
  assert.deepEqual(rowsText(counts), ["Physical: 2", "Logical: 4"]);
  assert.equal(rowsText(frequency)[0], "Core 1");
  assert.match(rowsText(swap)[3], /12.5 %/);
  assert.match(rowsText(disk)[0], /Read bytes: 2 KiB/);
  assert.match(rowsText(partitions).join("\n"), /Filesystem: NTFS/);
});

test("selects GPU readings by sensor id and preserves unsupported warning values", async () => {
  const gpu = widgets.createGpuThermalFan({ sensorId: "gpu/0/core" });
  created.push(gpu);
  await waitForPoll();
  assert.match(rowsText(gpu).join("\n"), /Core: 47.5 °C/);
  assert.match(rowsText(gpu).join("\n"), /Warning: n\/a °C/);
  assert.match(rowsText(gpu).join("\n"), /Fan: 1,200 RPM/);
});

test("network transfer speeds start unavailable and use manager deltas", async () => {
  const originalNow = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    const transfer = widgets.createNetworkTelemetryTransfer();
    created.push(transfer);
    await waitForPoll();
    assert.match(rowsText(transfer).join("\n"), /Upload speed: n\/a n\/a\/s/);
    responseSnapshot = {
      ...snapshot,
      network: { ...snapshot.network, bytes_sent: 2048, bytes_received: 4096 },
    };
    now = 2000;
    timers.at(-1)();
    await waitForPoll();
    assert.doesNotMatch(rowsText(transfer).join("\n"), /Upload speed: n\/a n\/a\/s/);
  } finally {
    Date.now = originalNow;
  }
});

test("removed legacy constructors are not exported", () => {
  assert.equal("createMemoryList" in widgets, false);
  assert.equal("createCpuFrequenciesList" in widgets, false);
  assert.equal("createHardwareSensor" in widgets, false);
});
