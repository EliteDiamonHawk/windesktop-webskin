import assert from "node:assert/strict";
import test from "node:test";

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = {};
    this.className = "";
    this.style = {
      values: new Map(),
      setProperty: (name, value) => this.style.values.set(name, String(value)),
      getPropertyValue: (name) => this.style.values.get(name) ?? "",
    };
    this.textContent = "";
    this.listeners = new Map();
  }

  append(...children) {
    children.forEach((child) => {
      if (child?.parentNode) {
        child.parentNode.children = child.parentNode.children.filter((current) => current !== child);
      }
      if (child && typeof child === "object") child.parentNode = this;
      this.children.push(child);
    });
  }
  replaceChildren(...children) {
    this.children.forEach((child) => {
      if (child?.parentNode === this) child.parentNode = null;
    });
    this.children = [];
    this.append(...children);
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  removeEventListener(name, listener) {
    if (this.listeners.get(name) === listener) this.listeners.delete(name);
  }
  click() { return this.listeners.get("click")?.(); }

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
  system: {
    available: true,
    boot_time: "2023-11-14T22:13:20+00:00",
  },
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
let timerDelays = [];
let settingsRequests = 0;
let created = [];

const installDom = () => {
  const head = new FakeElement("head");
  globalThis.document = {
    head,
    createElement: (tagName) => new FakeElement(tagName),
    createTextNode: (text) => ({ textContent: String(text) }),
    getElementById: (id) => head.children.find((child) => child.id === id) ?? null,
  };
  globalThis.window = {
    setTimeout: (callback, delay) => {
      timers.push(callback);
      timerDelays.push(delay);
      return timers.length;
    },
    clearTimeout: () => {},
  };
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/api/settings/widgets/system-intervals")) {
      settingsRequests += 1;
      return {
        ok: true,
        json: async () => ({ fast: 5, standard: 30, slow: 60, widgets: { "memory-plain": 15 } }),
      };
    }
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
  timerDelays = [];
  created = [];
});

test.afterEach(() => {
  created.splice(0).forEach((element) => element.destroy?.());
});

test("formats dynamic values, preserves literals, and requests only referenced fields", async () => {
  const memory = widgets.createMemory({ format: "Used={used}\\nUsage {percent} %" });
  created.push(memory);
  assert.equal(memory.dataset.webskinWidgetVariant, "plain");
  assert.equal(memory.dataset.webskinWidgetState, "initial");
  assert.deepEqual(rowsText(memory), ["Used=-", "Usage - %"]);
  const valueParts = [...memory.querySelectorAll('[data-webskin-system-format-part="used"]')];
  await waitForPoll();
  assert.equal(memory.dataset.webskinWidgetState, "ready");
  assert.deepEqual(rowsText(memory), ["Used=2", "Usage 50 %"]);
  assert.equal(memory.querySelector('[data-webskin-system-format-part="used"]'), valueParts[0]);
  assert.deepEqual(
    [...memory.querySelectorAll('[data-webskin-system-format-part="used"]')].map((part) => part.textContent),
    ["2"],
  );
  const fields = new URL(requestUrls[0], "http://localhost").searchParams.get("fields").split(",").sort();
  assert.deepEqual(fields, ["memory.virtual.percent", "memory.virtual.used_bytes"]);
  assert.equal(timerDelays.at(-1), 15000);
  assert.equal(settingsRequests, 1);
});

test("renders single-value cards with icon and shape assets", async () => {
  const cpu = widgets.createCpuUtilizationPrestyled();
  created.push(cpu);
  assert.equal(cpu.dataset.webskinWidgetVariant, "prestyled");
  assert.equal(cpu.dataset.webskinSystemState, "initial");
  const liveContent = cpu.parts.value.children[0];

  assert.equal(cpu.parts.subtext.textContent, "CPU");
  assert.equal(liveContent.dataset.webskinSystemPart, "content");
  assert.equal(
    cpu.parts.icon.children[0].style.getPropertyValue("mask-image"),
    'url("/assets/icons/wave-pulse-svgrepo-com.svg")',
  );
  assert.equal(
    cpu.parts.iconFrame.children[0].style.getPropertyValue("mask-image"),
    'url("/assets/shapes/flower.svg")',
  );
  await waitForPoll();
  assert.equal(cpu.dataset.webskinSystemState, "ready");
  assert.equal(cpu.parts.value.children[0], liveContent);
  assert.equal(textOf(cpu.parts.value), "12.5%");
});

test("prestylized last-boot wraps plain lifecycle and destroys it", async () => {
  const originalNow = Date.now;
  Date.now = () => 1_700_001_234_000;
  try {
    const boot = widgets.createLastBootPrestyled({ updateInterval: 1 });
    created.push(boot);

    assert.equal(typeof boot.subscribeBootTime, "function");
    assert.equal(typeof boot.unsubscribeBootTime, "function");
    assert.equal(textOf(boot.parts.value), "- s");

    boot.unsubscribeBootTime();
    boot.subscribeBootTime();
    await waitForPoll();
    assert.equal(textOf(boot.parts.value), "1,234 s");

    boot.destroy();
    assert.equal(typeof boot.destroy, "function");
  } finally {
    Date.now = originalNow;
  }
});

test("prestylized metric cards use compact renderers on outer roots", async () => {
  const battery = widgets.createBatteryPrestyled({ updateInterval: 11 });
  const disk = widgets.createDiskUsagePrestyled({ updateInterval: 12 });
  const network = widgets.createNetworkPrestyled({ updateInterval: 13 });
  created.push(battery, disk, network);

  await waitForPoll();
  assert.equal(textOf(battery.parts.value), "87.5%");
  assert.equal(textOf(disk.parts.value), "40%");
  assert.equal(textOf(network.parts.value), "n/a");
});

test("destroying prestylized card stops its outer-root poller", async () => {
  const cpu = widgets.createCpuUtilizationPrestyled({ updateInterval: 14 });
  created.push(cpu);
  await waitForPoll();
  const requests = requestUrls.length;

  cpu.destroy();
  timers.at(-1)?.();
  await waitForPoll();
  assert.equal(requestUrls.length, requests);
});

test("last-boot defaults to boot time and requests only that field", async () => {
  const boot = widgets.createLastBoot();
  created.push(boot);

  assert.deepEqual(rowsText(boot), ["-"]);
  await waitForPoll();

  assert.deepEqual(rowsText(boot), ["2023-11-14T22:13:20+00:00"]);
  const fields = new URL(requestUrls[0], "http://localhost").searchParams.get("fields").split(",");
  assert.deepEqual(fields, ["system.boot_time"]);
  assert.equal(timers.length, 0);
});

test("last-boot custom formats calculate uptime in the browser", async () => {
  const originalNow = Date.now;
  let now = 1_700_001_234_000;
  Date.now = () => now;
  const combined = widgets.createLastBoot({ format: "Boot={boot-time}\\nUptime={uptime} seconds" });
  created.push(combined);

  try {
    assert.deepEqual(rowsText(combined), ["Boot=-", "Uptime=- seconds"]);
    await waitForPoll();

    assert.deepEqual(rowsText(combined), ["Boot=2023-11-14T22:13:20+00:00", "Uptime=1,234 seconds"]);
    const fields = new URL(requestUrls[0], "http://localhost").searchParams.get("fields").split(",");
    assert.deepEqual(fields, ["system.boot_time"]);
    assert.equal(timerDelays.at(-1), 60000);

    now += 60_000;
    timers[0]();
    assert.deepEqual(rowsText(combined), ["Boot=2023-11-14T22:13:20+00:00", "Uptime=1,294 seconds"]);
    assert.equal(requestUrls.length, 1);
  } finally {
    Date.now = originalNow;
  }
});

test("last-boot supports live browser updates and manual boot-time cancellation", async () => {
  const originalNow = Date.now;
  Date.now = () => 1_700_001_234_000;
  const boot = widgets.createLastBoot({ format: "{uptime}", updateInterval: 1 });
  created.push(boot);

  try {
    await waitForPoll();
    assert.equal(timerDelays.at(-1), 1000);
    assert.equal(requestUrls.length, 1);

    boot.subscribeBootTime();
    boot.unsubscribeBootTime();
    await waitForPoll();
    assert.equal(requestUrls.length, 1);

    boot.subscribeBootTime();
    await waitForPoll();
    assert.equal(requestUrls.length, 2);
  } finally {
    Date.now = originalNow;
  }
});

test("coalesces widgets with the same endpoint and update interval", async () => {
  const memory = widgets.createMemory({ format: "{used}", updateInterval: 30 });
  const network = widgets.createNetworkTelemetry({ format: "{sent}", updateInterval: 30 });
  created.push(memory, network);
  await waitForPoll();
  assert.equal(requestUrls.length, 1);
  const fields = new URL(requestUrls[0], "http://localhost").searchParams.get("fields").split(",").sort();
  assert.deepEqual(fields, ["memory.virtual.used_bytes", "network.bytes_sent"]);
});

test("uses independent polling families and supports update interval overrides", async () => {
  const memory = widgets.createMemory({ format: "{used}" });
  const cpu = widgets.createCpuUtilization({ format: "{value}" });
  const standard = widgets.createCpuTelemetry();
  const override = widgets.createBattery({ updateInterval: 2 });
  const explicit = widgets.createSwapMemory({ updateInterval: 12 });
  created.push(memory, cpu, standard, override, explicit);
  await waitForPoll();

  assert.equal(requestUrls.length, 5);
  assert.ok(timerDelays.includes(15000));
  assert.ok(timerDelays.includes(5000));
  assert.ok(timerDelays.includes(30000));
  assert.ok(timerDelays.includes(2000));
  assert.ok(timerDelays.includes(12000));
});

test("rejects legacy millisecond interval option", () => {
  assert.throws(() => widgets.createMemory({ interval: 1000 }), TypeError);
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

test("creates plain system controls and protects shutdown/restart by default", async () => {
  const logout = widgets.createLogout();
  const shutdown = widgets.createShutdown();
  const restart = widgets.createRestart({ safety: false });
  created.push(logout, shutdown, restart);

  assert.equal(logout.tagName, "button");
  assert.equal(logout.type, "button");
  assert.equal(logout.textContent, "Log Out");
  assert.equal(shutdown.textContent, "Shutdown");
  assert.equal(restart.textContent, "Restart");

  logout.click();
  shutdown.click();
  shutdown.click();
  restart.click();
  await waitForPoll();
  assert.deepEqual(requestUrls, [
    "/api/system/controls/logout",
    "/api/system/controls/restart",
  ]);

  shutdown.click();
  await waitForPoll();
  assert.deepEqual(requestUrls, [
    "/api/system/controls/logout",
    "/api/system/controls/restart",
    "/api/system/controls/shutdown",
  ]);
});
