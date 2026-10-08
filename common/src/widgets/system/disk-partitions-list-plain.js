import { createPart, createRow, createSystemWidget, formatText, setMetricText } from "./client.js";

const createPartitionRow = (partition, index, format) => {
  const row = document.createElement("div");
  row.dataset.webskinSystemPart = `partition-${index}`;
  row.className = "webskin-system-list-row";
  const mountPoint = createRow(`partition-${index}-mount-point`, "Mount point", { format });
  const filesystem = createRow(`partition-${index}-filesystem`, "Filesystem", { format });
  const mountOptions = createRow(`partition-${index}-mount-options`, "Mount options", { format });
  setMetricText(mountPoint, `partition-${index}-mount-point`, formatText(partition.mount_point));
  setMetricText(filesystem, `partition-${index}-filesystem`, formatText(partition.filesystem));
  setMetricText(mountOptions, `partition-${index}-mount-options`, formatText(partition.mount_options));
  row.append(mountPoint, filesystem, mountOptions);
  return row;
};

export function createDiskPartitionsList(options = {}) {
  const { format } = options;
  return createSystemWidget({
    ...options,
    type: "disk-partitions-list",
    build: (root) => root.append(createPart("partitions", "", "div")),
    render: (root, snapshot) => {
      const list = root.querySelector('[data-webskin-system-part="partitions"]');
      list.replaceChildren();
      const partitions = snapshot.disks?.partitions;
      if (!Array.isArray(partitions) || !partitions.length) {
        list.append(createPart("partitions-unavailable", "No disk partitions available"));
        return;
      }
      partitions.forEach((partition, index) => list.append(createPartitionRow(partition, index, format)));
    },
  });
}
