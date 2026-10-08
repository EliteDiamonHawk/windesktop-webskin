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

const content = document.querySelector("#system-showcase-content");
let mountedWidgets = [];

const groups = [
  {
    title: "CPU",
    description: "Utilization, capacity, clock speed, hardware counters, and load averages.",
    widgets: [
      ["CPU utilization", "Overall and per-core percentages.", createCpuUtilization],
      ["CPU core counts", "Physical and logical processor counts.", createCpuCoreCounts],
      ["CPU frequencies", "Current, minimum, and maximum clock speeds.", createCpuFrequencies],
      ["CPU hardware telemetry", "Interrupts, system calls, and context switches.", createCpuTelemetry],
      ["CPU load averages", "One, five, and fifteen-minute averages.", createCpuLoadAverage],
    ],
  },
  {
    title: "Memory",
    description: "Physical memory and swap/pagefile capacity.",
    widgets: [
      ["Virtual memory / RAM", "Total, available, used, free, and usage percentage.", createMemory],
      ["Swap memory", "Total, used, free, and paging usage percentage.", createSwap],
    ],
  },
  {
    title: "Storage",
    description: "Local partitions, capacity, and aggregate disk I/O.",
    widgets: [
      ["Disk partitions", "Local mount points, filesystem types, and mount options.", createDiskPartitions],
      ["Disk usage and space", "Total, used, free, and capacity percentage per mount point.", createDiskUsage],
      ["Disk I/O performance", "Read/write counts, bytes transferred, and wait times.", createDiskIo],
    ],
  },
  {
    title: "Network and hardware",
    description: "Aggregate network counters and best-effort hardware sensors.",
    widgets: [
      ["Network bandwidth telemetry", "Aggregate bytes, packet drops, and transmission errors.", createNetworkTelemetry],
      ["Hardware sensors", "Live temperatures and fan speeds when exposed by the OS.", createHardwareSensors],
    ],
  },
];

const createCard = ([title, description, createWidget]) => {
  const card = document.createElement("article");
  card.className = "system-card";
  const heading = document.createElement("h4");
  heading.textContent = title;
  const note = document.createElement("p");
  note.className = "system-card__note";
  note.textContent = description;
  const stage = document.createElement("div");
  stage.className = "system-card__stage";
  const widget = createWidget({ interval: 5000, format: "{label}: {value} {unit}" });
  stage.append(widget);
  card.append(heading, note, stage);
  mountedWidgets.push(widget);
  return card;
};

const mount = () => {
  if (!content || mountedWidgets.length) return;
  const fragment = document.createDocumentFragment();
  groups.forEach(({ title, description, widgets }) => {
    const group = document.createElement("section");
    group.className = "system-group";
    const heading = document.createElement("div");
    heading.className = "system-group__heading";
    const titleElement = document.createElement("h3");
    titleElement.textContent = title;
    const descriptionElement = document.createElement("p");
    descriptionElement.textContent = description;
    heading.append(titleElement, descriptionElement);
    const grid = document.createElement("div");
    grid.className = "system-grid";
    widgets.forEach((definition) => grid.append(createCard(definition)));
    group.append(heading, grid);
    fragment.append(group);
  });
  content.replaceChildren(fragment);
};

const unmount = () => {
  mountedWidgets.splice(0).forEach((widget) => widget.destroy?.());
  content?.replaceChildren();
};

document.addEventListener("webskin:showcase-page-change", (event) => {
  if (event.detail.page === "system") mount();
  else unmount();
});

