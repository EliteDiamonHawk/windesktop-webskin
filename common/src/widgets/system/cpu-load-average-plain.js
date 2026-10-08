import { createRow, createSystemWidget, formatNumber, setMetricText } from "./client.js";

export function createCpuLoadAverage(options = {}) {
  const { format } = options;
  return createSystemWidget({
    ...options,
    type: "cpu-load-average",
    build: (root) => root.append(
      createRow("one-minute", "1 minute", { format }),
      createRow("five-minutes", "5 minutes", { format }),
      createRow("fifteen-minutes", "15 minutes", { format }),
    ),
    render: (root, snapshot) => {
      const load = snapshot.cpu?.load_average;
      setMetricText(root, "one-minute", formatNumber(load?.one_minute));
      setMetricText(root, "five-minutes", formatNumber(load?.five_minutes));
      setMetricText(root, "fifteen-minutes", formatNumber(load?.fifteen_minutes));
    },
  });
}

