import { createRow, createSystemWidget, formatBytes, formatNumber, setMetricText } from "./client.js";

export function createSwap(options = {}) {
  const { format } = options;
  return createSystemWidget({
    ...options,
    type: "swap",
    build: (root) => root.append(
      createRow("total", "Total", { format }),
      createRow("used", "Used", { format }),
      createRow("free", "Free", { format }),
      createRow("paging-percent", "Paging usage", { format }),
    ),
    render: (root, snapshot) => {
      const swap = snapshot.memory?.swap;
      setMetricText(root, "total", formatBytes(swap?.total_bytes));
      setMetricText(root, "used", formatBytes(swap?.used_bytes));
      setMetricText(root, "free", formatBytes(swap?.free_bytes));
      setMetricText(root, "paging-percent", formatNumber(swap?.percent, "%"));
    },
  });
}

