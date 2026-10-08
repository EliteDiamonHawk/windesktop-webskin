import { createRow, createSystemWidget, formatBytes, formatNumber, setMetricText } from "./client.js";

export function createDiskIoList(options = {}) {
  const { format } = options;
  return createSystemWidget({
    ...options,
    type: "disk-io-list",
    build: (root) => root.append(
      createRow("read-count", "Read operations", { format }),
      createRow("write-count", "Write operations", { format }),
      createRow("read-bytes", "Read bytes", { format }),
      createRow("write-bytes", "Write bytes", { format }),
      createRow("read-time", "Read wait", { format }),
      createRow("write-time", "Write wait", { format }),
      createRow("busy-time", "Busy time", { format }),
    ),
    render: (root, snapshot) => {
      const io = snapshot.disks?.io;
      setMetricText(root, "read-count", formatNumber(io?.read_count, "", 0));
      setMetricText(root, "write-count", formatNumber(io?.write_count, "", 0));
      setMetricText(root, "read-bytes", formatBytes(io?.read_bytes));
      setMetricText(root, "write-bytes", formatBytes(io?.write_bytes));
      setMetricText(root, "read-time", formatNumber(io?.read_time_ms, "ms"));
      setMetricText(root, "write-time", formatNumber(io?.write_time_ms, "ms"));
      setMetricText(root, "busy-time", formatNumber(io?.busy_time_ms, "ms"));
    },
  });
}
