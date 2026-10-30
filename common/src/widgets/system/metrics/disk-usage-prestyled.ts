import { createDiskPartitions as createPlainDiskPartitions } from "./disk-partitions-plain.js";
import { createSingleValueSystemWidget, iconAsset, iconFrameAsset } from "./single-value.js";
import { requireNonEmptyString } from "./validation.js";

export function createDiskUsagePrestyled(options = {}) {
  if (options.mountPoint !== undefined) requireNonEmptyString(options, "mountPoint");
  return createSingleValueSystemWidget({
    ...options,
    type: "disk-usage-prestyled",
    widgetId: "disk-usage-prestyled",
    createPlain: createPlainDiskPartitions,
    plainOptions: { ...options, format: "{usage}%" },
    label: options.label ?? "Disk",
    icon: iconAsset("floppy-disk-svgrepo-com.svg"),
    iconFrame: iconFrameAsset("soft-burst.svg"),
  });
}
