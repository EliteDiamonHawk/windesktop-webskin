import { createRow, createSystemWidget, formatNumber, setMetricText } from "./client.js";

export function createCpuCoreCountsList(options = {}) {
  const { format } = options;
  return createSystemWidget({
    ...options,
    type: "cpu-core-counts-list",
    build: (root) => root.append(createRow("physical", "Physical", { format }), createRow("logical", "Logical", { format })),
    render: (root, snapshot) => {
      const cores = snapshot.cpu?.cores;
      setMetricText(root, "physical", formatNumber(cores?.physical, "", 0));
      setMetricText(root, "logical", formatNumber(cores?.logical, "", 0));
    },
  });
}
