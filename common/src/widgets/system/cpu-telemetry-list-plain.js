import { createRow, createSystemWidget, formatNumber, setMetricText } from "./client.js";

export function createCpuTelemetryList(options = {}) {
  const { format } = options;
  return createSystemWidget({
    ...options,
    type: "cpu-telemetry-list",
    build: (root) => root.append(
      createRow("interrupts", "Interrupts", { format }),
      createRow("system-calls", "System calls", { format }),
      createRow("context-switches", "Context switches", { format }),
    ),
    render: (root, snapshot) => {
      const telemetry = snapshot.cpu?.telemetry;
      setMetricText(root, "interrupts", formatNumber(telemetry?.interrupts, "", 0));
      setMetricText(root, "system-calls", formatNumber(telemetry?.system_calls, "", 0));
      setMetricText(root, "context-switches", formatNumber(telemetry?.context_switches, "", 0));
    },
  });
}
