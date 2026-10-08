import { createRow, createSystemWidget, formatBytes, formatNumber, setMetricText } from "./client.js";

export function createMemoryList(options = {}) {
  const { format } = options;
  return createSystemWidget({
    ...options,
    type: "memory-list",
    build: (root) => root.append(
      createRow("total", "Total", { format }),
      createRow("available", "Available", { format }),
      createRow("used", "Used", { format }),
      createRow("free", "Free", { format }),
      createRow("percent", "Usage", { format }),
    ),
    render: (root, snapshot) => {
      const memory = snapshot.memory?.virtual;
      setMetricText(root, "total", formatBytes(memory?.total_bytes));
      setMetricText(root, "available", formatBytes(memory?.available_bytes));
      setMetricText(root, "used", formatBytes(memory?.used_bytes));
      setMetricText(root, "free", formatBytes(memory?.free_bytes));
      setMetricText(root, "percent", formatNumber(memory?.percent, "%"));
    },
  });
}
