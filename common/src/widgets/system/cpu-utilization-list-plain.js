import { createPart, createRow, createSystemWidget, formatNumber, setMetricText } from "./client.js";

export function createCpuUtilizationList(options = {}) {
  const { format } = options;
  return createSystemWidget({
    ...options,
    type: "cpu-utilization-list",
    build: (root) => {
      root.append(createRow("overall", "Overall", { format }));
      root.append(createPart("per-core", "", "div"));
    },
    render: (root, snapshot) => {
      const utilization = snapshot.cpu?.utilization;
      setMetricText(root, "overall", formatNumber(utilization?.overall, "%"));
      const list = root.querySelector('[data-webskin-system-part="per-core"]');
      list.replaceChildren();
      if (!utilization?.available || !Array.isArray(utilization.per_core)) {
        list.append(createPart("per-core-unavailable", "Per-core utilization unavailable"));
        return;
      }
      utilization.per_core.forEach((value, index) => {
        const row = createRow(`core-${index}`, `Core ${index + 1}`, { format });
        setMetricText(row, `core-${index}`, formatNumber(value, "%"));
        list.append(row);
      });
    },
  });
}
