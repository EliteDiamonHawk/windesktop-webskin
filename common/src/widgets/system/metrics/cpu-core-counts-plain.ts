import { createPart, createSystemWidget, fieldsForFormat, renderTokenFormat, resolveFormat } from "./client.js";
import { formatInteger } from "./formatters.js";

const DEFAULT_FORMAT = "Physical: {physical}\nLogical: {logical}";
const TOKENS = ["physical", "phys", "logical", "logi"];
const TOKEN_FIELDS = {
  physical: "cpu.cores.physical",
  phys: "cpu.cores.physical",
  logical: "cpu.cores.logical",
  logi: "cpu.cores.logical",
};

export function createCpuCoreCounts(options = {}) {
  const format = resolveFormat(options.format, DEFAULT_FORMAT, TOKENS, "CPU core counts");
  return createSystemWidget({
    ...options,
    fields: fieldsForFormat(format, TOKEN_FIELDS),
    type: "cpu-core-counts",
    build: (root) => root.append(createPart("content", "", "div")),
    render: (root, snapshot, { phase }) => renderTokenFormat(
      root.querySelector('[data-webskin-system-part="content"]'),
      format,
      {
        physical: formatInteger(snapshot?.cpu?.cores?.physical, phase),
        phys: formatInteger(snapshot?.cpu?.cores?.physical, phase),
        logical: formatInteger(snapshot?.cpu?.cores?.logical, phase),
        logi: formatInteger(snapshot?.cpu?.cores?.logical, phase),
      },
      { fallback: phase === "initial" ? "-" : "n/a" },
    ),
  });
}
