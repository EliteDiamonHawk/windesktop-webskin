import { createVariantSystemWidget, formatBytes, formatNumber } from "./client.js";

export function createNetworkTelemetry(variantOrOptions, options) {
  return createVariantSystemWidget({
    variantOrOptions,
    options,
    defaultVariant: "bytes-sent",
    family: "network-telemetry",
    variants: {
      "bytes-sent": { part: "bytes-sent", label: "Bytes sent", read: (snapshot) => formatBytes(snapshot.network?.bytes_sent) },
      "bytes-received": { part: "bytes-received", label: "Bytes received", read: (snapshot) => formatBytes(snapshot.network?.bytes_received) },
      "packets-dropped": { part: "packets-dropped", label: "Packets dropped", read: (snapshot) => formatNumber(snapshot.network?.packets_dropped, "", 0) },
      "transmission-errors": { part: "transmission-errors", label: "Transmission errors", read: (snapshot) => formatNumber(snapshot.network?.transmission_errors, "", 0) },
    },
  });
}
