import { createPart, createSystemWidget, fieldsForFormat, renderTokenFormat, resolveFormat } from "./client.js";
import { formatBytes, formatInteger } from "./formatters.js";

const DEFAULT_FORMAT = "Read bytes: {read-bytes} {read-unit}\nWrite bytes: {write-bytes} {write-unit}\nRead count: {read-count}\nWrite count: {write-count}\nRead time: {read-time} ms\nWrite time: {write-time} ms\nBusy time: {busy-time} ms";
const TOKENS = ["read-count", "read-bytes", "read-time", "read-unit", "write-count", "write-bytes", "write-time", "write-unit", "busy-time"];
const TOKEN_FIELDS = {
  "read-count": "disks.io.read_count",
  "read-bytes": "disks.io.read_bytes",
  "read-unit": "disks.io.read_bytes",
  "read-time": "disks.io.read_time_ms",
  "write-count": "disks.io.write_count",
  "write-bytes": "disks.io.write_bytes",
  "write-unit": "disks.io.write_bytes",
  "write-time": "disks.io.write_time_ms",
  "busy-time": "disks.io.busy_time_ms",
};

export function createDiskIo(options = {}) {
  const format = resolveFormat(options.format, DEFAULT_FORMAT, TOKENS, "disk I/O");
  return createSystemWidget({
    ...options,
    fields: fieldsForFormat(format, TOKEN_FIELDS),
    type: "disk-io",
    build: (root) => root.append(createPart("content", "", "div")),
    render: (root, snapshot, { phase }) => {
      const io = snapshot?.disks?.io;
      const read = formatBytes(io?.read_bytes, phase);
      const write = formatBytes(io?.write_bytes, phase);
      renderTokenFormat(root.querySelector('[data-webskin-system-part="content"]'), format, {
        "read-count": formatInteger(io?.read_count, phase),
        "read-bytes": read.value,
        "read-unit": read.unit,
        "read-time": formatInteger(io?.read_time_ms, phase),
        "write-count": formatInteger(io?.write_count, phase),
        "write-bytes": write.value,
        "write-unit": write.unit,
        "write-time": formatInteger(io?.write_time_ms, phase),
        "busy-time": formatInteger(io?.busy_time_ms, phase),
      }, { fallback: phase === "initial" ? "-" : "n/a" });
    },
  });
}
