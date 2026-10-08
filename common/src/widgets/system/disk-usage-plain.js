import { createVariantSystemWidget, findRecord, formatBytes, formatNumber, formatText, requireNonEmptyString } from "./client.js";

export function createDiskUsage(variantOrOptions, options) {
  const parsedOptions = variantOrOptions && typeof variantOrOptions === "object" && !Array.isArray(variantOrOptions)
    ? variantOrOptions
    : options ?? {};
  const mountPoint = requireNonEmptyString(parsedOptions, "mountPoint");
  return createVariantSystemWidget({
    variantOrOptions,
    options,
    defaultVariant: "percent",
    family: "disk-usage",
    variants: {
      "mount-point": { part: "mount-point", label: "Mount point", read: (snapshot) => formatText(findRecord(snapshot.disks?.usage, "mount_point", mountPoint)?.mount_point) },
      total: { part: "total", label: "Total", read: (snapshot) => formatBytes(findRecord(snapshot.disks?.usage, "mount_point", mountPoint)?.total_bytes) },
      used: { part: "used", label: "Used", read: (snapshot) => formatBytes(findRecord(snapshot.disks?.usage, "mount_point", mountPoint)?.used_bytes) },
      free: { part: "free", label: "Free", read: (snapshot) => formatBytes(findRecord(snapshot.disks?.usage, "mount_point", mountPoint)?.free_bytes) },
      percent: { part: "percent", label: "Capacity", read: (snapshot) => formatNumber(findRecord(snapshot.disks?.usage, "mount_point", mountPoint)?.percent, "%") },
    },
  });
}
