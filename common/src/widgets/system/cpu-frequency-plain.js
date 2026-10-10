import { createPart, createSystemWidget, fieldsForFormat, renderTokenFormat, resolveFormat } from "./client.js";
import { formatNumber } from "./formatters.js";
import { requireInteger } from "./validation.js";

const TOKENS = ["curr", "current", "min", "minimum", "max", "maximum", "core", "zeroed-core"];
const TOKEN_FIELDS = {
  curr: "cpu.frequencies.current_mhz",
  current: "cpu.frequencies.current_mhz",
  min: "cpu.frequencies.minimum_mhz",
  minimum: "cpu.frequencies.minimum_mhz",
  max: "cpu.frequencies.maximum_mhz",
  maximum: "cpu.frequencies.maximum_mhz",
  core: "cpu.frequencies.per_core",
  "zeroed-core": "cpu.frequencies.per_core",
};
const PER_CORE_FIELDS = {
  curr: "cpu.frequencies.per_core.current_mhz",
  current: "cpu.frequencies.per_core.current_mhz",
  min: "cpu.frequencies.per_core.minimum_mhz",
  minimum: "cpu.frequencies.per_core.minimum_mhz",
  max: "cpu.frequencies.per_core.maximum_mhz",
  maximum: "cpu.frequencies.per_core.maximum_mhz",
  core: "cpu.frequencies.per_core.current_mhz",
  "zeroed-core": "cpu.frequencies.per_core.current_mhz",
};

export function createCpuFrequency(options = {}) {
  const core = options.core === undefined ? -1 : requireInteger(options, "core");
  const defaultFormat = core < 0
    ? "Overall\nCurrent: {current} MHz\nMinimum: {min} MHz\nMaximum: {max} MHz"
    : "Core {core}\nCurrent: {current} MHz\nMinimum: {min} MHz\nMaximum: {max} MHz";
  const format = resolveFormat(options.format, defaultFormat, TOKENS, "CPU frequency");
  return createSystemWidget({
    ...options,
    fields: fieldsForFormat(format, core < 0 ? TOKEN_FIELDS : PER_CORE_FIELDS),
    type: "cpu-frequency",
    build: (root) => root.append(createPart("content", "", "div")),
    render: (root, snapshot, { phase }) => {
      const frequencies = snapshot?.cpu?.frequencies;
      const selected = core < 0 ? frequencies : frequencies?.per_core?.[core];
      const values = {
        curr: formatNumber(selected?.current_mhz ?? (core < 0 ? frequencies?.current_mhz : undefined), phase),
        current: formatNumber(selected?.current_mhz ?? (core < 0 ? frequencies?.current_mhz : undefined), phase),
        min: formatNumber(selected?.minimum_mhz ?? (core < 0 ? frequencies?.minimum_mhz : undefined), phase),
        minimum: formatNumber(selected?.minimum_mhz ?? (core < 0 ? frequencies?.minimum_mhz : undefined), phase),
        max: formatNumber(selected?.maximum_mhz ?? (core < 0 ? frequencies?.maximum_mhz : undefined), phase),
        maximum: formatNumber(selected?.maximum_mhz ?? (core < 0 ? frequencies?.maximum_mhz : undefined), phase),
        core: core < 0 ? "-1" : String(core + 1),
        "zeroed-core": String(core),
      };
      renderTokenFormat(root.querySelector('[data-webskin-system-part="content"]'), format, values, {
        fallback: phase === "initial" ? "-" : "n/a",
      });
    },
  });
}
