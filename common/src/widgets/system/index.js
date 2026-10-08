// Canonical scalar family factories.
export { createCpuUtilizationMetric } from "./cpu-utilization-metric-plain.js";
export { createCpuCoreCountMetric } from "./cpu-core-count-metric-plain.js";
export { createCpuFrequency } from "./cpu-frequency-plain.js";
export { createCpuTelemetryMetric } from "./cpu-telemetry-metric-plain.js";
export { createCpuLoadAverageMetric } from "./cpu-load-average-metric-plain.js";
export { createMemoryMetric } from "./memory-metric-plain.js";
export { createSwapMetric } from "./swap-metric-plain.js";
export { createDiskIo } from "./disk-io-metric-plain.js";
export { createNetworkTelemetryMetric } from "./network-telemetry-metric-plain.js";
export { createDiskPartitionMetric } from "./disk-partition-metric-plain.js";
export { createDiskUsageMetric } from "./disk-usage-metric-plain.js";
export { createHardwareSensorMetric } from "./hardware-sensor-metric-plain.js";

// Canonical legacy multi-value widgets.
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

// Deprecated compatibility exports for existing themes.
export { createCpuUtilization } from "./cpu-utilization-plain.js";
export { createCpuCoreCounts } from "./cpu-core-counts-plain.js";
export { createCpuFrequencies } from "./cpu-frequencies-plain.js";
export { createCpuTelemetry } from "./cpu-telemetry-plain.js";
export { createCpuLoadAverage } from "./cpu-load-average-plain.js";
export { createMemory } from "./memory-plain.js";
export { createSwap } from "./swap-plain.js";
export { createDiskPartitions } from "./disk-partitions-plain.js";
export { createDiskUsage } from "./disk-usage-plain.js";
export { createNetworkTelemetry } from "./network-telemetry-plain.js";
export { createHardwareSensors } from "./hardware-sensors-plain.js";
