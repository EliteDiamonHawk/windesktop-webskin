import { createPart, createSystemWidget, fieldsForFormat, renderTokenFormat, resolveFormat } from "./client.js";
import { formatInteger } from "./formatters.js";

const DEFAULT_FORMAT = "Interrupts: {ints}\nSystem calls: {syscall}\nContext switches: {cont-switch}";
const TOKENS = ["ints", "interrupts", "syscall", "system-calls", "cont-switch", "context-switches"];
const TOKEN_FIELDS = {
  ints: "cpu.telemetry.interrupts",
  interrupts: "cpu.telemetry.interrupts",
  syscall: "cpu.telemetry.system_calls",
  "system-calls": "cpu.telemetry.system_calls",
  "cont-switch": "cpu.telemetry.context_switches",
  "context-switches": "cpu.telemetry.context_switches",
};

export function createCpuTelemetry(options = {}) {
  const format = resolveFormat(options.format, DEFAULT_FORMAT, TOKENS, "CPU telemetry");
  const digitLimit = options.digitLimit;
  return createSystemWidget({
    ...options,
    fields: fieldsForFormat(format, TOKEN_FIELDS),
    type: "cpu-telemetry",
    build: (root) => root.append(createPart("content", "", "div")),
    render: (root, snapshot, { phase }) => {
      const telemetry = snapshot?.cpu?.telemetry;
      renderTokenFormat(root.querySelector('[data-webskin-system-part="content"]'), format, {
        ints: formatInteger(telemetry?.interrupts, phase, digitLimit),
        interrupts: formatInteger(telemetry?.interrupts, phase, digitLimit),
        syscall: formatInteger(telemetry?.system_calls, phase, digitLimit),
        "system-calls": formatInteger(telemetry?.system_calls, phase, digitLimit),
        "cont-switch": formatInteger(telemetry?.context_switches, phase, digitLimit),
        "context-switches": formatInteger(telemetry?.context_switches, phase, digitLimit),
      }, { fallback: phase === "initial" ? "-" : "n/a" });
    },
  });
}
