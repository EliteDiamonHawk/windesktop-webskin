import { createCpuCoreCounts } from "/common/widgets/system/cpu-core-counts-plain.js";
import { createCpuFrequencies } from "/common/widgets/system/cpu-frequencies-plain.js";
import { createCpuLoadAverage } from "/common/widgets/system/cpu-load-average-plain.js";
import { createCpuTelemetry } from "/common/widgets/system/cpu-telemetry-plain.js";
import { createCpuUtilization } from "/common/widgets/system/cpu-utilization-plain.js";
import { createDiskIo } from "/common/widgets/system/disk-io-plain.js";
import { createDiskPartitions } from "/common/widgets/system/disk-partitions-plain.js";
import { createDiskUsage } from "/common/widgets/system/disk-usage-plain.js";
import { createHardwareSensors } from "/common/widgets/system/hardware-sensors-plain.js";
import { createMemory } from "/common/widgets/system/memory-plain.js";
import { createNetworkTelemetry } from "/common/widgets/system/network-telemetry-plain.js";
import { createSwap } from "/common/widgets/system/swap-plain.js";

const gallery = document.querySelector("#system-gallery");
let mounted = [];

const groups = [
  {
    title: "CPU",
    widgets: [
      ["CPU utilization", createCpuUtilization],
      ["CPU core counts", createCpuCoreCounts],
      ["CPU frequencies", createCpuFrequencies],
      ["CPU telemetry", createCpuTelemetry],
      ["CPU load average", createCpuLoadAverage],
    ],
  },
  {
    title: "Memory",
    widgets: [
      ["Memory", createMemory],
      ["Swap", createSwap],
    ],
  },
  {
    title: "Storage",
    widgets: [
      ["Disk partitions", createDiskPartitions],
      ["Disk usage", createDiskUsage],
      ["Disk I/O", createDiskIo],
    ],
  },
  {
    title: "Network and hardware",
    widgets: [
      ["Network telemetry", createNetworkTelemetry],
      ["Hardware sensors", createHardwareSensors],
    ],
  },
];

const createExample = ([label, createWidget]) => {
  const example = document.createElement("section");
  example.className = "widget-example";

  const heading = document.createElement("h3");
  heading.textContent = label;

  const stage = document.createElement("div");
  stage.className = "widget-example__stage";
  stage.style.setProperty("--widget-scale", "1");

  const widget = createWidget();
  stage.append(widget);
  example.append(heading, stage);
  return { example, widget };
};

const mount = () => {
  if (!gallery || mounted.length) return;
  const fragment = document.createDocumentFragment();
  const widgets = [];

  for (const { title, widgets: definitions } of groups) {
    const group = document.createElement("section");
    group.className = "system-group";

    const heading = document.createElement("h2");
    heading.textContent = title;

    const list = document.createElement("div");
    list.className = "widget-list";
    for (const definition of definitions) {
      const { example, widget } = createExample(definition);
      list.append(example);
      widgets.push(widget);
    }
    group.append(heading, list);
    fragment.append(group);
  }

  gallery.replaceChildren(fragment);
  mounted = widgets;
};

const unmount = () => {
  mounted.splice(0).forEach((widget) => widget.destroy?.());
  gallery?.replaceChildren();
};

document.addEventListener("webskin:showcase-page-change", (event) => {
  if (event.detail.page === "system") mount();
  else unmount();
});

if (!document.querySelector('[data-showcase-panel="system"]')?.hidden) mount();
