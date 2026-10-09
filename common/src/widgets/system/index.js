// Scalar widgets: each constructor renders one value.
export { createBattery } from "./battery-plain.js";
export { createCpuUtilization } from "./cpu-utilization-plain.js";
export { createCpuCoreCount } from "./cpu-core-count-plain.js";
export { createCpuFrequency } from "./cpu-frequency-plain.js";
export { createCpuTelemetry } from "./cpu-telemetry-plain.js";
export { createCpuLoadAverage } from "./cpu-load-average-plain.js";
export { createMemory } from "./memory-plain.js";
export { createSwap } from "./swap-plain.js";
export { createDiskIo } from "./disk-io-plain.js";
export { createNetworkTelemetry } from "./network-telemetry-plain.js";
export { createDiskPartition } from "./disk-partition-plain.js";
export { createDiskUsage } from "./disk-usage-plain.js";
export { createHardwareSensor } from "./hardware-sensor-plain.js";

// Explicit multi-value widgets.
export { createCpuUtilizationList } from "./cpu-utilization-list-plain.js";
export { createCpuCoreCountsList } from "./cpu-core-counts-list-plain.js";
export { createCpuFrequenciesList } from "./cpu-frequencies-list-plain.js";
export { createCpuTelemetryList } from "./cpu-telemetry-list-plain.js";
export { createCpuLoadAverageList } from "./cpu-load-average-list-plain.js";
export { createMemoryList } from "./memory-list-plain.js";
export { createSwapList } from "./swap-list-plain.js";
export { createDiskPartitionsList } from "./disk-partitions-list-plain.js";
export { createDiskUsageList } from "./disk-usage-list-plain.js";
export { createDiskIoList } from "./disk-io-list-plain.js";
export { createNetworkTelemetryList } from "./network-telemetry-list-plain.js";
export { createHardwareSensorsList } from "./hardware-sensors-list-plain.js";
