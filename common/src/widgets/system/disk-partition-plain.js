import { createVariantSystemWidget, findRecord, formatText, requireNonEmptyString } from "./client.js";

export function createDiskPartition(variantOrOptions, options) {
  const parsedOptions = variantOrOptions && typeof variantOrOptions === "object" && !Array.isArray(variantOrOptions)
    ? variantOrOptions
    : options ?? {};
  const mountPoint = requireNonEmptyString(parsedOptions, "mountPoint");
  return createVariantSystemWidget({
    variantOrOptions,
    options,
    defaultVariant: "mount-point",
    family: "disk-partition",
    variants: {
      "mount-point": { part: "mount-point", label: "Mount point", read: (snapshot) => formatText(findRecord(snapshot.disks?.partitions, "mount_point", mountPoint)?.mount_point) },
      filesystem: { part: "filesystem", label: "Filesystem", read: (snapshot) => formatText(findRecord(snapshot.disks?.partitions, "mount_point", mountPoint)?.filesystem) },
      "mount-options": { part: "mount-options", label: "Mount options", read: (snapshot) => formatText(findRecord(snapshot.disks?.partitions, "mount_point", mountPoint)?.mount_options) },
    },
  });
}
