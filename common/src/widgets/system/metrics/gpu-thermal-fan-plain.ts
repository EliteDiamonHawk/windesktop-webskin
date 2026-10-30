import { createPart, createSystemWidget, fieldsForFormat, renderTokenFormat, resolveFormat } from "./client.js";
import { formatNumber, formatText } from "./formatters.js";
import { requireNonEmptyString } from "./validation.js";

const DEFAULT_FORMAT = "Core: {core-temperature} °C\nHot spot: {hot-spot-temperature} °C\nWarning: {warning-temperature} °C\nCritical: {critical-temperature} °C\nFan: {fan-speed} RPM";
const TOKENS = ["core-temperature", "core-temp", "hot-spot-temperature", "hot-spot", "warning-temperature", "warning", "critical-temperature", "critical", "fan-speed", "fan", "gpu"];

const isGpu = (record) => {
  const type = String(record?.hardware_type ?? "").toLowerCase();
  return type.includes("gpu") || type.includes("video") || type.includes("graphics");
};

const sensorName = (record) => String(record?.name ?? "").toLowerCase().replace(/[\s_-]+/g, "");

const chooseGpuRecords = (readings, options) => {
  if (!Array.isArray(readings)) return [];
  if (options.sensorId !== undefined) {
    requireNonEmptyString(options, "sensorId");
    const selected = readings.find((record) => record?.id === options.sensorId);
    return selected ? readings.filter((record) => record?.hardware_id === selected.hardware_id) : [];
  }
  if (options.gpuId !== undefined) {
    requireNonEmptyString(options, "gpuId");
    return readings.filter((record) => record?.hardware_id === options.gpuId || record?.hardware_name === options.gpuId);
  }
  const selected = readings.find(isGpu);
  return selected ? readings.filter((record) => record?.hardware_id === selected.hardware_id) : [];
};

const pick = (records, predicate) => records.find(predicate);

export function createGpuThermalFan(options = {}) {
  const format = resolveFormat(options.format, DEFAULT_FORMAT, TOKENS, "GPU thermal and fan sensors");
  return createSystemWidget({
    ...options,
    fields: fieldsForFormat(format, { ...Object.fromEntries(TOKENS.map((token) => [token, "sensors.readings"])) }),
    type: "gpu-thermal-fan",
    build: (root) => root.append(createPart("content", "", "div")),
    render: (root, snapshot, { phase }) => {
      const records = chooseGpuRecords(snapshot?.sensors?.readings, options);
      const core = pick(records, (record) => record?.type === "temperature" && !sensorName(record).includes("hotspot") && !sensorName(record).includes("hotspottemperature"));
      const hotSpot = pick(records, (record) => record?.type === "temperature" && (sensorName(record).includes("hotspot") || sensorName(record).includes("junction")));
      const warning = pick(records, (record) => record?.warning !== undefined || sensorName(record).includes("warning"));
      const critical = pick(records, (record) => record?.critical !== undefined && record?.critical !== null) ?? core ?? hotSpot;
      const fan = pick(records, (record) => record?.type === "fan");
      const gpuName = records[0]?.hardware_name;
      const temperature = (record) => formatNumber(record?.value, phase);
      const values = {
        "core-temperature": temperature(core),
        "core-temp": temperature(core),
        "hot-spot-temperature": temperature(hotSpot),
        "hot-spot": temperature(hotSpot),
        "warning-temperature": temperature(warning?.warning ?? warning?.value),
        warning: temperature(warning?.warning ?? warning?.value),
        "critical-temperature": temperature(critical?.critical),
        critical: temperature(critical?.critical),
        "fan-speed": formatNumber(fan?.value, phase, 0),
        fan: formatNumber(fan?.value, phase, 0),
        gpu: formatText(gpuName, phase),
      };
      renderTokenFormat(root.querySelector('[data-webskin-system-part="content"]'), format, values, {
        fallback: phase === "initial" ? "-" : "n/a",
      });
    },
  });
}
