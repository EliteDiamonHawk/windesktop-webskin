import { createVariantSystemWidget, formatNumber } from "./client.js";

export function createCpuTelemetry(variantOrOptions, options) {
  return createVariantSystemWidget({
    variantOrOptions,
    options,
    defaultVariant: "interrupts",
    family: "cpu-telemetry",
    variants: {
      interrupts: { part: "interrupts", label: "Interrupts", read: (snapshot) => formatNumber(snapshot.cpu?.telemetry?.interrupts, "", 0) },
      "system-calls": { part: "system-calls", label: "System calls", read: (snapshot) => formatNumber(snapshot.cpu?.telemetry?.system_calls, "", 0) },
      "context-switches": { part: "context-switches", label: "Context switches", read: (snapshot) => formatNumber(snapshot.cpu?.telemetry?.context_switches, "", 0) },
    },
  });
}
