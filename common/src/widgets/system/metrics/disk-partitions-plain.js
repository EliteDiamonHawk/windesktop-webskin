import { createPart, createSystemWidget, fieldsForFormat, renderTokenFormat, resolveFormat } from "./client.js";
import { formatBytes, formatNumber, formatText } from "./formatters.js";
import { requireNonEmptyString } from "./validation.js";

const DEFAULT_FORMAT = "Mount: {mount-point}\nFilesystem: {filesystem}\nOptions: {mount-options}\nUsed: {used} {used-unit}\nTotal: {total} {total-unit}\nFree: {free} {free-unit}\nUsage: {usage} %";
const TOKENS = ["mount-point", "filesystem", "mount-options", "total", "total-unit", "used", "used-unit", "free", "free-unit", "usage", "percent"];
const TOKEN_FIELDS = {
  "mount-point": "disks.partitions.mount_point",
  filesystem: "disks.partitions.filesystem",
  "mount-options": "disks.partitions.mount_options",
  total: "disks.usage.total_bytes",
  "total-unit": "disks.usage.total_bytes",
  used: "disks.usage.used_bytes",
  "used-unit": "disks.usage.used_bytes",
  free: "disks.usage.free_bytes",
  "free-unit": "disks.usage.free_bytes",
  usage: "disks.usage.percent",
  percent: "disks.usage.percent",
};

export function createDiskPartitions(options = {}) {
  if (options.mountPoint !== undefined) requireNonEmptyString(options, "mountPoint");
  const format = resolveFormat(options.format, DEFAULT_FORMAT, TOKENS, "disk partitions");
  const fields = new Set(fieldsForFormat(format, TOKEN_FIELDS));
  fields.add("disks.partitions.mount_point");
  if (["total", "total-unit", "used", "used-unit", "free", "free-unit", "usage", "percent"]
    .some((token) => format.includes("{" + token + "}"))) {
    fields.add("disks.usage.mount_point");
  }
  return createSystemWidget({
    ...options,
    fields: [...fields],
    type: "disk-partitions",
    build: (root) => root.append(createPart("content", "", "div")),
    render: (root, snapshot, { phase }) => {
      const partitions = snapshot?.disks?.partitions;
      const usages = snapshot?.disks?.usage;
      const selected = Array.isArray(partitions)
        ? (options.mountPoint ? partitions.find((item) => item?.mount_point === options.mountPoint) : partitions[0])
        : undefined;
      const usage = selected && Array.isArray(usages)
        ? usages.find((item) => item?.mount_point === selected.mount_point)
        : undefined;
      const total = formatBytes(usage?.total_bytes, phase);
      const used = formatBytes(usage?.used_bytes, phase);
      const free = formatBytes(usage?.free_bytes, phase);
      renderTokenFormat(root.querySelector('[data-webskin-system-part="content"]'), format, {
        "mount-point": formatText(selected?.mount_point, phase),
        filesystem: formatText(selected?.filesystem, phase),
        "mount-options": formatText(selected?.mount_options, phase),
        total: total.value,
        "total-unit": total.unit,
        used: used.value,
        "used-unit": used.unit,
        free: free.value,
        "free-unit": free.unit,
        usage: formatNumber(usage?.percent, phase),
        percent: formatNumber(usage?.percent, phase),
      }, { fallback: phase === "initial" ? "-" : "n/a" });
    },
  });
}
