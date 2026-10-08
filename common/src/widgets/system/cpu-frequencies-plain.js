import { createPart, createRow, createSystemWidget, formatNumber, setMetricText } from "./client.js";

export function createCpuFrequencies(options = {}) {
  const { format } = options;
  return createSystemWidget({
    ...options,
    type: "cpu-frequencies",
    build: (root) => root.append(
      createRow("current", "Current", { format }),
      createRow("minimum", "Minimum", { format }),
      createRow("maximum", "Maximum", { format }),
      createPart("per-core", "", "div"),
    ),
    render: (root, snapshot) => {
      const frequencies = snapshot.cpu?.frequencies;
      setMetricText(root, "current", formatNumber(frequencies?.current_mhz, "MHz"));
      setMetricText(root, "minimum", formatNumber(frequencies?.minimum_mhz, "MHz"));
      setMetricText(root, "maximum", formatNumber(frequencies?.maximum_mhz, "MHz"));
      const list = root.querySelector('[data-webskin-system-part="per-core"]');
      list.replaceChildren();
      if (!frequencies?.available || !Array.isArray(frequencies.per_core) || !frequencies.per_core.length) {
        list.append(createPart("per-core-unavailable", "Per-core frequencies unavailable"));
        return;
      }
      frequencies.per_core.forEach((frequency, index) => {
        const row = createRow(`core-${index}`, `Core ${index + 1}`, { format });
        setMetricText(row, `core-${index}`, formatNumber(frequency.current_mhz, "MHz"));
        list.append(row);
      });
    },
  });
}

