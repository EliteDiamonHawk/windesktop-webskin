import { createVariantSystemWidget, findRecord, formatNumber, formatText, requireNonEmptyString } from "./client.js";

export function createHardwareSensorMetric(variantOrOptions, options) {
  const parsedOptions = variantOrOptions && typeof variantOrOptions === "object" && !Array.isArray(variantOrOptions)
    ? variantOrOptions
    : options ?? {};
  const sensorId = requireNonEmptyString(parsedOptions, "sensorId");
  const readSensor = (snapshot) => findRecord(snapshot.sensors?.readings, "id", sensorId);
  const readNumber = (field) => (snapshot) => {
    const record = readSensor(snapshot);
    return formatNumber(record?.[field], record?.unit ?? "");
  };
  return createVariantSystemWidget({
    variantOrOptions,
    options,
    defaultVariant: "value",
    family: "hardware-sensor",
    variants: {
      name: { part: "name", label: "Sensor", read: (snapshot) => formatText(readSensor(snapshot)?.name) },
      value: { part: "value", label: "Value", read: readNumber("value") },
      minimum: { part: "minimum", label: "Minimum", read: readNumber("minimum") },
      maximum: { part: "maximum", label: "Maximum", read: readNumber("maximum") },
      critical: { part: "critical", label: "Critical", read: readNumber("critical") },
    },
  });
}
