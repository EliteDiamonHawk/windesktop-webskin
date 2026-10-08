import { createRow, createSystemWidget, formatBytes, formatNumber, setMetricText } from "./client.js";

export function createNetworkTelemetryList(options = {}) {
  const { format } = options;
  return createSystemWidget({
    ...options,
    type: "network-telemetry-list",
    build: (root) => root.append(
      createRow("bytes-sent", "Bytes sent", { format }),
      createRow("bytes-received", "Bytes received", { format }),
      createRow("packets-dropped", "Packets dropped", { format }),
      createRow("transmission-errors", "Transmission errors", { format }),
    ),
    render: (root, snapshot) => {
      const network = snapshot.network;
      setMetricText(root, "bytes-sent", formatBytes(network?.bytes_sent));
      setMetricText(root, "bytes-received", formatBytes(network?.bytes_received));
      setMetricText(root, "packets-dropped", formatNumber(network?.packets_dropped, "", 0));
      setMetricText(root, "transmission-errors", formatNumber(network?.transmission_errors, "", 0));
    },
  });
}
