import { createPart, createSystemWidget, fieldsForFormat, renderTokenFormat, resolveFormat } from "./client.js";
import { formatBytes, formatNumber } from "./formatters.js";

const DEFAULT_FORMAT = "Uploaded: {uploaded} {uploaded-unit}\nDownloaded: {downloaded} {downloaded-unit}\nUpload speed: {upload-speed} {upload-speed-unit}/s\nDownload speed: {download-speed} {download-speed-unit}/s\nUtilization: {utilization} %";
const TOKENS = ["uploaded", "sent", "uploaded-unit", "sent-unit", "downloaded", "received", "downloaded-unit", "received-unit", "upload-speed", "upload-speed-unit", "upload-rate", "download-speed", "download-speed-unit", "download-rate", "utilization"];
const TOKEN_FIELDS = Object.fromEntries(TOKENS.map((token) => [token, "network.bytes_sent"]));
Object.assign(TOKEN_FIELDS, {
  downloaded: "network.bytes_received",
  received: "network.bytes_received",
  "downloaded-unit": "network.bytes_received",
  "received-unit": "network.bytes_received",
  "download-speed": "network.bytes_received",
  "download-speed-unit": "network.bytes_received",
  "upload-rate": "network.bytes_sent",
  "download-rate": "network.bytes_received",
  utilization: [],
});

const formatRate = (value, phase, digitLimit) => {
  const formatted = formatBytes(value, phase, digitLimit);
  return formatted.value === "-" || formatted.value === "n/a"
    ? formatted.value
    : formatted.value + " " + formatted.unit + "/s";
};

export function createNetworkTelemetryTransfer(options = {}) {
  const format = resolveFormat(options.format, DEFAULT_FORMAT, TOKENS, "network telemetry transfer");
  const digitLimit = options.digitLimit;
  return createSystemWidget({
    ...options,
    fields: fieldsForFormat(format, TOKEN_FIELDS),
    type: "network-telemetry-transfer",
    build: (root) => root.append(createPart("content", "", options.contentTag ?? "div")),
    render: (root, snapshot, { phase }) => {
      const transfer = snapshot?.network?.transfer;
      const uploaded = formatBytes(transfer?.uploaded, phase, digitLimit);
      const downloaded = formatBytes(transfer?.downloaded, phase, digitLimit);
      const uploadSpeed = formatBytes(transfer?.upload_speed, phase, digitLimit);
      const downloadSpeed = formatBytes(transfer?.download_speed, phase, digitLimit);
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
        "upload-rate": formatRate(transfer?.upload_speed, phase, digitLimit),
        "download-speed": downloadSpeed.value,
        "download-speed-unit": downloadSpeed.unit,
        "download-rate": formatRate(transfer?.download_speed, phase, digitLimit),
        utilization: formatNumber(transfer?.utilization, phase, 1, digitLimit),
      }, { fallback: phase === "initial" ? "-" : "n/a" });
    },
  });
}
