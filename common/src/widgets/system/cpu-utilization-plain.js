import { createPart, createSystemWidget, fieldsForFormat, renderTokenFormat, resolveFormat } from "./client.js";
import { formatNumber } from "./formatters.js";
import { requireInteger } from "./validation.js";

const TOKENS = ["value", "core", "zeroed-core"];
const OVERALL_FIELDS = {
  value: "cpu.utilization.overall",
  core: "cpu.utilization.overall",
  "zeroed-core": "cpu.utilization.overall",
};
const CORE_FIELDS = {
  value: "cpu.utilization.per_core",
  core: "cpu.utilization.per_core",
  "zeroed-core": "cpu.utilization.per_core",
};

export function createCpuUtilization(options = {}) {
  const core = options.core === undefined ? -1 : requireInteger(options, "core");
  const defaultFormat = core < 0 ? "{value} %" : "{core}: {value} %";
  const fields = fieldsForFormat(resolveFormat(options.format, defaultFormat, TOKENS, "CPU utilization"), core < 0 ? OVERALL_FIELDS : CORE_FIELDS);
  const format = resolveFormat(options.format, defaultFormat, TOKENS, "CPU utilization");
  return createSystemWidget({
    ...options,
    fields,
    type: "cpu-utilization",
    build: (root) => root.append(createPart("content", "", "div")),
    render: (root, snapshot, { phase }) => {
      const value = core < 0
        ? snapshot?.cpu?.utilization?.overall
        : snapshot?.cpu?.utilization?.per_core?.[core];
      renderTokenFormat(root.querySelector('[data-webskin-system-part="content"]'), format, {
        value: formatNumber(value, phase),
        core: core < 0 ? "-1" : String(core + 1),
        "zeroed-core": String(core),
      }, { fallback: phase === "initial" ? "-" : "n/a" });
    },
  });
}
