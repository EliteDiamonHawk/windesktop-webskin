import { createPart, createRow, createSystemWidget, formatBytes, formatNumber, formatText, setMetricText } from "./client.js";

const createUsageRow = (usage, index, format) => {
  const row = document.createElement("div");
  row.dataset.webskinSystemPart = `usage-${index}`;
  row.className = "webskin-system-list-row";
  const mountPoint = createRow(`usage-${index}-mount-point`, "Mount point", { format });
  const total = createRow(`usage-${index}-total`, "Total", { format });
  const used = createRow(`usage-${index}-used`, "Used", { format });
  const free = createRow(`usage-${index}-free`, "Free", { format });
  const percent = createRow(`usage-${index}-percent`, "Capacity", { format });
  setMetricText(mountPoint, `usage-${index}-mount-point`, formatText(usage.mount_point));
  setMetricText(total, `usage-${index}-total`, formatBytes(usage.total_bytes));
  setMetricText(used, `usage-${index}-used`, formatBytes(usage.used_bytes));
  setMetricText(free, `usage-${index}-free`, formatBytes(usage.free_bytes));
  setMetricText(percent, `usage-${index}-percent`, formatNumber(usage.percent, "%"));
  row.append(
    mountPoint,
    total,
    used,
    free,
    percent,
  );
  return row;
};

export function createDiskUsage(options = {}) {
  const { format } = options;
  return createSystemWidget({
    ...options,
    type: "disk-usage",
    build: (root) => root.append(createPart("usage", "", "div")),
    render: (root, snapshot) => {
      const list = root.querySelector('[data-webskin-system-part="usage"]');
      list.replaceChildren();
      const usage = snapshot.disks?.usage;
      if (!Array.isArray(usage) || !usage.length) {
        list.append(createPart("usage-unavailable", "No disk usage available"));
        return;
      }
      usage.forEach((item, index) => list.append(createUsageRow(item, index, format)));
    },
  });
}

