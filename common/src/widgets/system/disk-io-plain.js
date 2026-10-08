import { createScalarSystemWidget, formatBytes, formatNumber } from "./client.js";

const variants = {
  "read-count": { part: "read-count", label: "Read operations", read: (snapshot) => formatNumber(snapshot.disks?.io?.read_count, "", 0) },
  "read-bytes": { part: "read-bytes", label: "Read bytes", read: (snapshot) => formatBytes(snapshot.disks?.io?.read_bytes) },
  "read-time": { part: "read-time", label: "Read wait", read: (snapshot) => formatNumber(snapshot.disks?.io?.read_time_ms, "ms") },
  "write-count": { part: "write-count", label: "Write operations", read: (snapshot) => formatNumber(snapshot.disks?.io?.write_count, "", 0) },
  "write-bytes": { part: "write-bytes", label: "Write bytes", read: (snapshot) => formatBytes(snapshot.disks?.io?.write_bytes) },
  "write-time": { part: "write-time", label: "Write wait", read: (snapshot) => formatNumber(snapshot.disks?.io?.write_time_ms, "ms") },
  "busy-time": { part: "busy-time", label: "Busy time", read: (snapshot) => formatNumber(snapshot.disks?.io?.busy_time_ms, "ms") },
};

export function createDiskIo(directionOrOptions, metricOrOptions, maybeOptions) {
  let direction = directionOrOptions;
  let metric = metricOrOptions;
  let options = maybeOptions;
  if (directionOrOptions && typeof directionOrOptions === "object" && !Array.isArray(directionOrOptions)) {
    direction = "read";
    metric = "bytes";
    options = directionOrOptions;
  } else if (metricOrOptions && typeof metricOrOptions === "object" && !Array.isArray(metricOrOptions)) {
    metric = "bytes";
    options = metricOrOptions;
  }
  direction ??= "read";
  metric ??= direction === "busy" ? "time" : "bytes";
  const key = `${direction}-${metric}`;
  const definition = variants[key];
  if (!definition) throw new TypeError(`Unsupported disk I/O selection: ${key}`);
  return createScalarSystemWidget({ options: options ?? {}, type: `disk-io-${key}`, ...definition });
}
