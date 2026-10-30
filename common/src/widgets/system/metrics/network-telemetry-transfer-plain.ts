import { createPart, createSystemWidget, fieldsForFormat, renderTokenFormat, resolveFormat } from "./client.js";
import { formatBytes, formatNumber } from "./formatters.js";

const DEFAULT_FORMAT = "Uploaded: {uploaded} {uploaded-unit}\nDownloaded: {downloaded} {downloaded-unit}\nUpload speed: {upload-speed} {upload-speed-unit}/s\nDownload speed: {download-speed} {download-speed-unit}/s\nUtilization: {utilization} %";
const TOKENS = ["uploaded", "sent", "uploaded-unit", "sent-unit", "downloaded", "received", "downloaded-unit", "received-unit", "upload-speed", "upload-speed-unit", "download-speed", "download-speed-unit", "utilization"];
const TOKEN_FIELDS = Object.fromEntries(TOKENS.map((token) => [token, "network.bytes_sent"]));
Object.assign(TOKEN_FIELDS, {
  downloaded: "network.bytes_received",
  received: "network.bytes_received",
  "downloaded-unit": "network.bytes_received",
  "received-unit": "network.bytes_received",
  "download-speed": "network.bytes_received",
  "download-speed-unit": "network.bytes_received",
  utilization: [],
});

export function createNetworkTelemetryTransfer(options = {}) {
  const format = resolveFormat(options.format, DEFAULT_FORMAT, TOKENS, "network telemetry transfer");
  return createSystemWidget({
    ...options,
    fields: fieldsForFormat(format, TOKEN_FIELDS),
    type: "network-telemetry-transfer",
    build: (root) => root.append(createPart("content", "", "div")),
    render: (root, snapshot, { phase }) => {
      const transfer = snapshot?.network?.transfer;
      const uploaded = formatBytes(transfer?.uploaded, phase);
      const downloaded = formatBytes(transfer?.downloaded, phase);
      const uploadSpeed = formatBytes(transfer?.upload_speed, phase);
      const downloadSpeed = formatBytes(transfer?.download_speed, phase);
      renderTokenFormat(root.querySelector('[data-webskin-system-part="content"]'), format, {
        uploaded: uploaded.value,
        sent: uploaded.value,
        "uploaded-unit": uploaded.unit,
        "sent-unit": uploaded.unit,
        downloaded: downloaded.value,
        received: downloaded.value,
        "downloaded-unit": downloaded.unit,
        "received-unit": downloaded.unit,
        "upload-speed": uploadSpeed.value,
        "upload-speed-unit": uploadSpeed.unit,
        "download-speed": downloadSpeed.value,
        "download-speed-unit": downloadSpeed.unit,
        utilization: formatNumber(transfer?.utilization, phase),
      }, { fallback: phase === "initial" ? "-" : "n/a" });
    },
  });
}
