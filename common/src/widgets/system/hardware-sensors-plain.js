import { createPart, createRow, createSystemWidget, formatNumber, formatText, setMetricText } from "./client.js";

const createTemperatureRow = (reading, index, format) => {
  const row = document.createElement("div");
  row.dataset.webskinSystemPart = `temperature-${index}`;
  row.className = "webskin-system-list-row";
  const label = createRow(`temperature-${index}-label`, "Sensor", { format });
  const current = createRow(`temperature-${index}-current`, "Current", { format });
  const minimum = createRow(`temperature-${index}-minimum`, "Minimum", { format });
  const maximum = createRow(`temperature-${index}-maximum`, "Maximum", { format });
  const critical = createRow(`temperature-${index}-critical`, "Critical", { format });
  setMetricText(label, `temperature-${index}-label`, formatText(reading.label));
  setMetricText(current, `temperature-${index}-current`, formatNumber(reading.current_c, "°C"));
  setMetricText(minimum, `temperature-${index}-minimum`, formatNumber(reading.minimum_c, "°C"));
  setMetricText(maximum, `temperature-${index}-maximum`, formatNumber(reading.maximum_c, "°C"));
  setMetricText(critical, `temperature-${index}-critical`, formatNumber(reading.critical_c, "°C"));
  row.append(
    label,
    current,
    minimum,
    maximum,
    critical,
  );
  return row;
};

const createFanRow = (reading, index, format) => {
  const row = document.createElement("div");
  row.dataset.webskinSystemPart = `fan-${index}`;
  row.className = "webskin-system-list-row";
  const label = createRow(`fan-${index}-label`, "Fan", { format });
  const current = createRow(`fan-${index}-current`, "Current", { format });
  setMetricText(label, `fan-${index}-label`, formatText(reading.label));
  setMetricText(current, `fan-${index}-current`, formatNumber(reading.current_rpm, "RPM", 0));
  row.append(
    label,
    current,
  );
  return row;
};

export function createHardwareSensors(options = {}) {
  const { format } = options;
  return createSystemWidget({
    ...options,
    type: "hardware-sensors",
    build: (root) => root.append(
      createPart("temperatures", "", "div"),
      createPart("fans", "", "div"),
    ),
    render: (root, snapshot) => {
      const sensors = snapshot.sensors;
      const temperatures = root.querySelector('[data-webskin-system-part="temperatures"]');
      const fans = root.querySelector('[data-webskin-system-part="fans"]');
      temperatures.replaceChildren();
      fans.replaceChildren();
      if (Array.isArray(sensors?.temperatures) && sensors.temperatures.length) {
        sensors.temperatures.forEach((reading, index) => temperatures.append(createTemperatureRow(reading, index, format)));
      } else {
        temperatures.append(createPart("temperatures-unavailable", "Temperature sensors unavailable"));
      }
      if (Array.isArray(sensors?.fans) && sensors.fans.length) {
        sensors.fans.forEach((reading, index) => fans.append(createFanRow(reading, index, format)));
      } else {
        fans.append(createPart("fans-unavailable", "Fan sensors unavailable"));
      }
    },
  });
}

