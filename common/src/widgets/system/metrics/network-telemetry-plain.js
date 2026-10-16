import { createPart, createSystemWidget, fieldsForFormat, renderTokenFormat, resolveFormat } from "./client.js";
import { formatBytes, formatInteger } from "./formatters.js";

const DEFAULT_FORMAT = "Sent: {sent} {sent-unit}\nReceived: {received} {received-unit}\nDropped: {dropped}\nErrors: {errors}";
const TOKENS = ["sent", "bytes-sent", "sent-unit", "received", "bytes-received", "received-unit", "dropped", "packets-dropped", "errors", "transmission-errors"];
const TOKEN_FIELDS = {
  sent: "network.bytes_sent",
  "bytes-sent": "network.bytes_sent",
  "sent-unit": "network.bytes_sent",
  received: "network.bytes_received",
  "bytes-received": "network.bytes_received",
  "received-unit": "network.bytes_received",
  dropped: "network.packets_dropped",
  "packets-dropped": "network.packets_dropped",
  errors: "network.transmission_errors",
  "transmission-errors": "network.transmission_errors",
};

export function createNetworkTelemetry(options = {}) {
  const format = resolveFormat(options.format, DEFAULT_FORMAT, TOKENS, "network telemetry");
  return createSystemWidget({
    ...options,
    fields: fieldsForFormat(format, TOKEN_FIELDS),
    type: "network-telemetry",
    build: (root) => root.append(createPart("content", "", "div")),
    render: (root, snapshot, { phase }) => {
      const network = snapshot?.network;
      const sent = formatBytes(network?.bytes_sent, phase);
      const received = formatBytes(network?.bytes_received, phase);
      renderTokenFormat(root.querySelector('[data-webskin-system-part="content"]'), format, {
        sent: sent.value,
        "bytes-sent": sent.value,
        "sent-unit": sent.unit,
        received: received.value,
        "bytes-received": received.value,
        "received-unit": received.unit,
        dropped: formatInteger(network?.packets_dropped, phase),
        "packets-dropped": formatInteger(network?.packets_dropped, phase),
        errors: formatInteger(network?.transmission_errors, phase),
        "transmission-errors": formatInteger(network?.transmission_errors, phase),
      }, { fallback: phase === "initial" ? "-" : "n/a" });
    },
  });
}
