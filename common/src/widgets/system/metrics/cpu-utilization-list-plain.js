import { createPart, createSystemWidget, fieldsForFormat, renderRepeatedFormat, resolveFormat } from "./client.js";
import { formatNumber } from "./formatters.js";
import { requireInteger } from "./validation.js";

const DEFAULT_FORMAT = "{label}: {value} %";
const TOKENS = ["label", "value"];
const TOKEN_FIELDS = {
  label: "cpu.utilization.per_core",
  value: ["cpu.utilization.overall", "cpu.utilization.per_core"],
};

export function createCpuUtilizationList(options = {}) {
  if (options.limit !== undefined && options.limit !== null) requireInteger(options, "limit");
  const format = resolveFormat(options.format, DEFAULT_FORMAT, TOKENS, "CPU utilization list");
  return createSystemWidget({
    ...options,
    fields: fieldsForFormat(format, TOKEN_FIELDS),
    type: "cpu-utilization-list",
    build: (root) => root.append(createPart("content", "", "div")),
    render: (root, snapshot, { phase }) => {
      const utilization = snapshot?.cpu?.utilization;
      const cores = Array.isArray(utilization?.per_core) ? utilization.per_core : [];
      const rows = [{ label: "Overall", value: formatNumber(utilization?.overall, phase) }];
      const zeroIndex = Boolean(options.zeroIndex);
      const limited = options.limit === undefined || options.limit === null || options.limit <= 0
        ? cores
        : cores.slice(0, options.limit);
      limited.forEach((value, index) => {
        rows.push({
          label: "Core " + (zeroIndex ? index : index + 1),
          value: formatNumber(value, phase),
        });
      });
      renderRepeatedFormat(root.querySelector('[data-webskin-system-part="content"]'), format, rows, {
        fallback: phase === "initial" ? "-" : "n/a",
      });
    },
  });
}
