import { createGpuThermalFan as createPlainGpuThermalFan } from "./gpu-thermal-fan-plain.js";
import { createSingleValueSystemWidget, iconAsset, iconFrameAsset } from "./single-value.js";
import { requireNonEmptyString } from "./validation.js";

export function createGpuTemperaturePrestyled(options = {}) {
  if (options.sensorId !== undefined) requireNonEmptyString(options, "sensorId");
  if (options.gpuId !== undefined) requireNonEmptyString(options, "gpuId");
  return createSingleValueSystemWidget({
    ...options,
    type: "gpu-temperature-prestyled",
    widgetId: "gpu-temperature-prestyled",
    createPlain: createPlainGpuThermalFan,
    plainOptions: { ...options, format: "{core-temperature} \u00c2\u00b0C" },
    label: options.label ?? "GPU",
    icon: iconAsset("microchip-svgrepo-com.svg"),
    iconFrame: iconFrameAsset("puffy-diamond.svg"),
  });
}
