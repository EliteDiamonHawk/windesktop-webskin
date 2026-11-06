using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using WebSkin.Backend.Infrastructure;

namespace WebSkin.Backend.Metrics;

public static class MetricFields
{
    public const int MinInterval = 1;
    public const int MaxInterval = 3600;
    public const int DefaultInterval = 5;
    public const int MaxSubscriptions = 256;
    public const int MaxFields = 64;

    public static readonly IReadOnlySet<string> Supported = new HashSet<string>(StringComparer.Ordinal)
    {
        "system.boot_time",
        "cpu.utilization", "cpu.utilization.overall", "cpu.utilization.per_core",
        "cpu.cores", "cpu.cores.physical", "cpu.cores.logical",
        "cpu.frequencies", "cpu.frequencies.current_mhz", "cpu.frequencies.minimum_mhz", "cpu.frequencies.maximum_mhz", "cpu.frequencies.per_core",
        "cpu.frequencies.per_core.current_mhz", "cpu.frequencies.per_core.minimum_mhz", "cpu.frequencies.per_core.maximum_mhz",
        "cpu.telemetry", "cpu.telemetry.interrupts", "cpu.telemetry.system_calls", "cpu.telemetry.context_switches",
        "cpu.load_average", "cpu.load_average.one_minute", "cpu.load_average.five_minutes", "cpu.load_average.fifteen_minutes",
        "memory.virtual", "memory.virtual.total_bytes", "memory.virtual.available_bytes", "memory.virtual.used_bytes", "memory.virtual.free_bytes", "memory.virtual.percent",
        "memory.swap", "memory.swap.total_bytes", "memory.swap.used_bytes", "memory.swap.free_bytes", "memory.swap.percent",
        "disks.partitions", "disks.partitions.mount_point", "disks.partitions.filesystem", "disks.partitions.mount_options",
        "disks.usage", "disks.usage.mount_point", "disks.usage.total_bytes", "disks.usage.used_bytes", "disks.usage.free_bytes", "disks.usage.percent",
        "disks.io", "disks.io.read_count", "disks.io.write_count", "disks.io.read_bytes", "disks.io.write_bytes", "disks.io.read_time_ms", "disks.io.write_time_ms", "disks.io.busy_time_ms",
        "network", "network.bytes_sent", "network.bytes_received", "network.packets_dropped", "network.transmission_errors",
        "sensors.temperatures", "sensors.fans", "sensors.battery", "sensors.battery.percent", "sensors.battery.seconds_left", "sensors.battery.power_plugged", "sensors.readings",
    };

    public static bool Requested(IReadOnlySet<string>? fields, string path) =>
        fields is null || fields.Any(field => field == path || field.StartsWith(path + ".", StringComparison.Ordinal) || path.StartsWith(field + ".", StringComparison.Ordinal));

    public static HashSet<string>? Parse(string? raw, bool stream = false)
    {
        if (raw is null) return null;
        if (stream && string.IsNullOrWhiteSpace(raw)) throw new MetricValidationException("Metric fields cannot be empty");
        var fields = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet(StringComparer.Ordinal);
        var invalid = fields.Where(field => !Supported.Contains(field)).OrderBy(field => field, StringComparer.Ordinal).FirstOrDefault();
        if (invalid is not null) throw new MetricValidationException($"Unsupported system metric field: {invalid}");
        if (stream && (fields.Count == 0 || fields.Count > MaxFields)) throw new MetricValidationException("Metric field selection is invalid");
        return fields;
    }

    public static int ValidateInterval(int? interval)
    {
        var value = interval ?? DefaultInterval;
        if (value is < MinInterval or > MaxInterval) throw new MetricValidationException($"Interval must be an integer from {MinInterval} through {MaxInterval}");
        return value;
    }
}

public sealed class MetricValidationException(string message) : Exception(message);

public interface ISystemMetricsProvider
{
    IReadOnlySet<string> SupportedFields { get; }
    Task<Dictionary<string, object?>> CollectAsync(IReadOnlySet<string>? requestedFields, CancellationToken cancellationToken = default);
    Dictionary<string, object?> ProjectSnapshot(Dictionary<string, object?> snapshot, IReadOnlySet<string>? requestedFields);
}

public sealed class SystemMetricsService : ISystemMetricsProvider, IDisposable
{
    private readonly IHardwareMonitor _hardware;
    private readonly IClock _clock;
    private readonly ConcurrentDictionary<string, Task<Dictionary<string, object?>>> _inflight = new(StringComparer.Ordinal);
    private readonly object _cacheGate = new();
    private readonly Dictionary<string, (double CollectedAt, Dictionary<string, object?> Value)> _cache = new(StringComparer.Ordinal);

    public SystemMetricsService(IHardwareMonitor hardware, IClock clock)
    {
        _hardware = hardware;
        _clock = clock;
        Subscriptions = new MetricSubscriptionManager(this);
    }

    public IReadOnlySet<string> SupportedFields => MetricFields.Supported;
    public MetricSubscriptionManager Subscriptions { get; }

    public Task<Dictionary<string, object?>> CollectAsync(IReadOnlySet<string>? requestedFields, CancellationToken cancellationToken = default)
    {
        const string key = "*";
        var fullSnapshot = _inflight.GetOrAdd(key, _ => CollectAndRemoveAsync(key));
        return ProjectAsync(fullSnapshot, requestedFields, cancellationToken);
    }

    public Dictionary<string, object?> ProjectSnapshot(Dictionary<string, object?> snapshot, IReadOnlySet<string>? requestedFields)
    {
        var copy = DeepCopy(snapshot);
        return requestedFields is null ? copy : Mask(copy, requestedFields);
    }

    public void Dispose()
    {
        Subscriptions.Dispose();
        _hardware.Dispose();
        lock (_cacheGate) _cache.Clear();
    }

    private async Task<Dictionary<string, object?>> CollectAndRemoveAsync(string key)
    {
        try { return await Task.Run(() => Collect(null), CancellationToken.None); }
        finally { _inflight.TryRemove(key, out _); }
    }

    private async Task<Dictionary<string, object?>> ProjectAsync(Task<Dictionary<string, object?>> snapshotTask, IReadOnlySet<string>? fields, CancellationToken cancellationToken)
    {
        var snapshot = await snapshotTask.WaitAsync(cancellationToken);
        return ProjectSnapshot(snapshot, fields);
    }

    private Dictionary<string, object?> Collect(IReadOnlySet<string>? fields)
    {
        var snapshot = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["timestamp"] = _clock.UtcNow.ToString("O"),
            ["system"] = Cached("system_boot", 3600, () => GetSystem(null)),
            ["cpu"] = Cached("cpu", 1, () => GetCpu(null)),
            ["memory"] = Cached("memory", 2, () => GetMemory(null)),
            ["disks"] = Cached("disks", 2, () => GetDisks(null)),
            ["network"] = Cached("network", 2, () => GetNetwork(null)),
            ["sensors"] = Cached("sensors", 2, () => GetSensors(null)),
        };
        return fields is null ? snapshot : Mask(snapshot, fields);
    }

    private Dictionary<string, object?> Cached(string source, double ttl, Func<Dictionary<string, object?>> factory)
    {
        var now = _clock.MonotonicSeconds;
        lock (_cacheGate)
        {
            if (_cache.TryGetValue(source, out var entry) && now >= entry.CollectedAt && now - entry.CollectedAt < ttl)
                return DeepCopy(entry.Value);
        }
        var value = factory();
        lock (_cacheGate) _cache[source] = (now, DeepCopy(value));
        return value;
    }

    private Dictionary<string, object?> GetSystem(IReadOnlySet<string>? fields)
    {
        if (!MetricFields.Requested(fields, "system")) return Group(false, ("boot_time", null));
        DateTimeOffset? boot = null;
        try
        {
            if (OperatingSystem.IsWindows()) boot = _clock.UtcNow - TimeSpan.FromMilliseconds(GetTickCount64());
        }
        catch { }
        return Group(boot is not null, ("boot_time", MetricFields.Requested(fields, "system.boot_time") ? boot?.ToString("O") : null));
    }

    private Dictionary<string, object?> GetCpu(IReadOnlySet<string>? fields)
    {
        var utilization = Group(false, ("overall", null), ("per_core", new List<object?>()));
        if (MetricFields.Requested(fields, "cpu.utilization"))
        {
            List<double> perCore = MetricFields.Requested(fields, "cpu.utilization.per_core") ? ReadProcessorCounter("% Processor Time") : [];
            double? overall = MetricFields.Requested(fields, "cpu.utilization.overall") ? ReadProcessorCounter("% Processor Time", "_Total").FirstOrDefault() : null;
            if (perCore.Count > 0) overall ??= perCore.Average();
            utilization = Group(overall is not null || perCore.Count > 0,
                ("overall", MetricFields.Requested(fields, "cpu.utilization.overall") ? overall : null),
                ("per_core", MetricFields.Requested(fields, "cpu.utilization.per_core") ? perCore.Cast<object?>().ToList() : new List<object?>()));
        }

        int? physical = MetricFields.Requested(fields, "cpu.cores.physical") ? TryGetPhysicalCoreCount() : null;
        int? logical = MetricFields.Requested(fields, "cpu.cores.logical") ? Environment.ProcessorCount : null;
        var cores = Group(physical is not null || logical is not null,
            ("physical", physical), ("logical", logical));

        var perCoreCurrent = MetricFields.Requested(fields, "cpu.frequencies.per_core")
            ? ReadProcessorCounter("Processor Frequency", null, "Processor Information")
            : [];
        var current = MetricFields.Requested(fields, "cpu.frequencies.current_mhz") ? ReadCounter("Processor Information", "Processor Frequency", "_Total") : null;
        if (current is null && perCoreCurrent.Count > 0) current = perCoreCurrent.Average();
        double? minimum = null;
        double? maximum = null;
        var perCoreFrequencies = perCoreCurrent
            .Select(value => (object?)new Dictionary<string, object?> { ["current_mhz"] = value, ["minimum_mhz"] = null, ["maximum_mhz"] = null })
            .ToList();
        if (current is null && MetricFields.Requested(fields, "cpu.frequencies"))
        {
            var clocks = _hardware.Read().Readings
                .Where(reading => reading.GetValueOrDefault("type")?.ToString() is "clock" or "frequency")
                .Select(reading => ToDouble(reading.GetValueOrDefault("value")))
                .Where(value => value is not null)
                .Select(value => value!.Value)
                .ToArray();
            if (clocks.Length > 0)
            {
                current = clocks.Average();
                if (perCoreFrequencies.Count == 0)
                    perCoreFrequencies = clocks.Select(value => (object?)new Dictionary<string, object?> { ["current_mhz"] = value, ["minimum_mhz"] = null, ["maximum_mhz"] = null }).ToList();
            }
        }
        var frequencies = Group(current is not null,
            ("current_mhz", current), ("minimum_mhz", minimum), ("maximum_mhz", maximum), ("per_core", MetricFields.Requested(fields, "cpu.frequencies.per_core") ? perCoreFrequencies : new List<object?>()));
        var telemetry = Group(false, ("interrupts", null), ("system_calls", null), ("context_switches", null));
        var load = Group(false, ("one_minute", null), ("five_minutes", null), ("fifteen_minutes", null));
        return new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["utilization"] = utilization,
            ["cores"] = cores,
            ["frequencies"] = frequencies,
            ["telemetry"] = telemetry,
            ["load_average"] = load,
        };
    }

    private Dictionary<string, object?> GetMemory(IReadOnlySet<string>? fields)
    {
        long total = 0, available = 0, used = 0, free = 0, swapTotal = 0, swapAvailable = 0;
        var memoryAvailable = MetricFields.Requested(fields, "memory.virtual") && TryGetMemory(out total, out available, out used, out free, out swapTotal, out swapAvailable);
        var virtualMemory = Group(memoryAvailable,
            ("total_bytes", MetricFields.Requested(fields, "memory.virtual.total_bytes") ? total : null),
            ("available_bytes", MetricFields.Requested(fields, "memory.virtual.available_bytes") ? available : null),
            ("used_bytes", MetricFields.Requested(fields, "memory.virtual.used_bytes") ? used : null),
            ("free_bytes", MetricFields.Requested(fields, "memory.virtual.free_bytes") ? free : null),
            ("percent", MetricFields.Requested(fields, "memory.virtual.percent") && total > 0 ? used * 100d / total : null));
        var swapUsed = swapTotal > 0 ? swapTotal - swapAvailable : 0;
        var swapAvailableResult = swapTotal > 0;
        var swap = Group(swapAvailableResult,
            ("total_bytes", MetricFields.Requested(fields, "memory.swap.total_bytes") && swapAvailableResult ? swapTotal : null),
            ("used_bytes", MetricFields.Requested(fields, "memory.swap.used_bytes") && swapAvailableResult ? swapUsed : null),
            ("free_bytes", MetricFields.Requested(fields, "memory.swap.free_bytes") && swapAvailableResult ? swapAvailable : null),
            ("percent", MetricFields.Requested(fields, "memory.swap.percent") && swapAvailableResult ? swapUsed * 100d / swapTotal : null));
        return new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["available"] = memoryAvailable || swapAvailableResult,
            ["virtual"] = virtualMemory,
            ["swap"] = swap,
        };
    }

    private Dictionary<string, object?> GetDisks(IReadOnlySet<string>? fields)
    {
        var partitions = new List<object?>();
        var usage = new List<object?>();
        if (MetricFields.Requested(fields, "disks.partitions") || MetricFields.Requested(fields, "disks.usage"))
        {
            foreach (var drive in SafeDrives())
            {
                var mount = drive.Name.TrimEnd('\\', '/');
                if (MetricFields.Requested(fields, "disks.partitions"))
                    partitions.Add(new Dictionary<string, object?> { ["mount_point"] = MetricFields.Requested(fields, "disks.partitions.mount_point") ? mount : null, ["filesystem"] = MetricFields.Requested(fields, "disks.partitions.filesystem") ? drive.DriveFormat : null, ["mount_options"] = MetricFields.Requested(fields, "disks.partitions.mount_options") ? string.Empty : null });
                if (MetricFields.Requested(fields, "disks.usage"))
                {
                    try
                    {
                        var total = drive.TotalSize;
                        var free = drive.AvailableFreeSpace;
                        usage.Add(new Dictionary<string, object?> { ["available"] = true, ["mount_point"] = mount, ["total_bytes"] = MetricFields.Requested(fields, "disks.usage.total_bytes") ? total : null, ["used_bytes"] = MetricFields.Requested(fields, "disks.usage.used_bytes") ? total - free : null, ["free_bytes"] = MetricFields.Requested(fields, "disks.usage.free_bytes") ? free : null, ["percent"] = MetricFields.Requested(fields, "disks.usage.percent") && total > 0 ? (total - free) * 100d / total : null });
                    }
                    catch { usage.Add(new Dictionary<string, object?> { ["available"] = false, ["mount_point"] = mount, ["total_bytes"] = null, ["used_bytes"] = null, ["free_bytes"] = null, ["percent"] = null }); }
                }
            }
        }
        var diskIo = Group(false, ("read_count", null), ("write_count", null), ("read_bytes", null), ("write_bytes", null), ("read_time_ms", null), ("write_time_ms", null), ("busy_time_ms", null));
        if (MetricFields.Requested(fields, "disks.io"))
        {
            var readCount = ReadRawCounter("PhysicalDisk", "Disk Reads/sec", "_Total");
            var writeCount = ReadRawCounter("PhysicalDisk", "Disk Writes/sec", "_Total");
            var readBytes = ReadRawCounter("PhysicalDisk", "Disk Read Bytes/sec", "_Total");
            var writeBytes = ReadRawCounter("PhysicalDisk", "Disk Write Bytes/sec", "_Total");
            var readTime = ReadRawCounter("PhysicalDisk", "Disk Read Time", "_Total");
            var writeTime = ReadRawCounter("PhysicalDisk", "Disk Write Time", "_Total");
            var busyTime = ReadRawCounter("PhysicalDisk", "% Disk Time", "_Total");
            diskIo = Group(readCount is not null || writeCount is not null || readBytes is not null || writeBytes is not null || readTime is not null || writeTime is not null || busyTime is not null,
                ("read_count", MetricFields.Requested(fields, "disks.io.read_count") ? readCount : null),
                ("write_count", MetricFields.Requested(fields, "disks.io.write_count") ? writeCount : null),
                ("read_bytes", MetricFields.Requested(fields, "disks.io.read_bytes") ? readBytes : null),
                ("write_bytes", MetricFields.Requested(fields, "disks.io.write_bytes") ? writeBytes : null),
                ("read_time_ms", MetricFields.Requested(fields, "disks.io.read_time_ms") ? ToMilliseconds(readTime) : null),
                ("write_time_ms", MetricFields.Requested(fields, "disks.io.write_time_ms") ? ToMilliseconds(writeTime) : null),
                ("busy_time_ms", MetricFields.Requested(fields, "disks.io.busy_time_ms") ? ToMilliseconds(busyTime) : null));
        }
        return new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["available"] = partitions.Count > 0 || usage.Count > 0 || (bool)diskIo["available"]!,
            ["partitions"] = partitions,
            ["usage"] = usage,
            ["io"] = diskIo,
        };
    }

    private Dictionary<string, object?> GetNetwork(IReadOnlySet<string>? fields)
    {
        if (!MetricFields.Requested(fields, "network")) return Group(false, ("bytes_sent", null), ("bytes_received", null), ("packets_dropped", null), ("transmission_errors", null));
        long sent = 0, received = 0, dropped = 0, errors = 0;
        var found = false;
        try
        {
            foreach (var network in NetworkInterface.GetAllNetworkInterfaces())
            {
                var statistics = network.GetIPv4Statistics();
                sent += statistics.BytesSent; received += statistics.BytesReceived;
                dropped += statistics.IncomingPacketsDiscarded + statistics.OutgoingPacketsDiscarded;
                errors += statistics.IncomingPacketsWithErrors + statistics.OutgoingPacketsWithErrors;
                found = true;
            }
        }
        catch { }
        return Group(found,
            ("bytes_sent", MetricFields.Requested(fields, "network.bytes_sent") ? sent : null),
            ("bytes_received", MetricFields.Requested(fields, "network.bytes_received") ? received : null),
            ("packets_dropped", MetricFields.Requested(fields, "network.packets_dropped") ? dropped : null),
            ("transmission_errors", MetricFields.Requested(fields, "network.transmission_errors") ? errors : null));
    }

    private Dictionary<string, object?> GetSensors(IReadOnlySet<string>? fields)
    {
        var wantsReadings = MetricFields.Requested(fields, "sensors.readings");
        var wantsTemperature = MetricFields.Requested(fields, "sensors.temperatures") || wantsReadings;
        var wantsFans = MetricFields.Requested(fields, "sensors.fans") || wantsReadings;
        var wantsBattery = MetricFields.Requested(fields, "sensors.battery");
        if (!wantsTemperature && !wantsFans && !wantsBattery)
            return EmptySensors();

        var hardware = _hardware.Read();
        var readings = hardware.Readings;
        var temperatures = wantsTemperature ? readings.Where(reading => Equals(reading.GetValueOrDefault("type"), "temperature")).Select(LegacyTemperature).Cast<object?>().ToList() : new List<object?>();
        var fans = wantsFans ? readings.Where(reading => Equals(reading.GetValueOrDefault("type"), "fan")).Select(LegacyFan).Cast<object?>().ToList() : new List<object?>();
        var allReadings = wantsReadings ? readings.Select(reading => new Dictionary<string, object?>(reading)).Cast<object?>().ToList() : new List<object?>();
        var battery = ReadBattery(wantsBattery);
        if (!(bool)battery["available"]! && wantsBattery)
        {
            var hardwareBattery = readings.FirstOrDefault(reading => reading.GetValueOrDefault("type")?.ToString() is "battery" or "level" || reading.GetValueOrDefault("hardware_type")?.ToString()?.Contains("battery", StringComparison.OrdinalIgnoreCase) == true || reading.GetValueOrDefault("hardware_name")?.ToString()?.Contains("battery", StringComparison.OrdinalIgnoreCase) == true);
            if (hardwareBattery is not null) battery = Battery(hardwareBattery.GetValueOrDefault("value") is not null, hardwareBattery.GetValueOrDefault("value"), null, null, "hardware_monitor");
        }
        if (!MetricFields.Requested(fields, "sensors.battery.percent")) battery["percent"] = null;
        if (!MetricFields.Requested(fields, "sensors.battery.seconds_left")) battery["seconds_left"] = null;
        if (!MetricFields.Requested(fields, "sensors.battery.power_plugged")) battery["power_plugged"] = null;
        if (wantsReadings && battery["available"] is true)
            allReadings.Add(new Dictionary<string, object?> { ["id"] = "system:battery:0", ["hardware_id"] = "battery", ["hardware_name"] = "Battery", ["hardware_type"] = "battery", ["name"] = "Battery", ["type"] = "battery", ["value"] = battery["percent"], ["unit"] = "%", ["minimum"] = null, ["maximum"] = null, ["warning"] = null, ["critical"] = null, ["source"] = "system" });
        return new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["available"] = temperatures.Count > 0 || fans.Count > 0 || allReadings.Count > 0 || (bool)battery["available"]!,
            ["temperatures"] = temperatures,
            ["fans"] = fans,
            ["battery"] = battery,
            ["readings"] = allReadings,
        };
    }

    private Dictionary<string, object?> ReadBattery(bool requested)
    {
        if (!requested) return Battery(false, null, null, null, null);
        try
        {
            if (!OperatingSystem.IsWindows()) return Battery(false, null, null, null, null);
            if (!GetSystemPowerStatus(out var status)) return Battery(false, null, null, null, null);
            uint? seconds = status.BatteryLifeTime == uint.MaxValue ? null : status.BatteryLifeTime;
            var plugged = status.ACLineStatus == 1;
            return Battery(true, status.BatteryLifePercent == 255 ? null : status.BatteryLifePercent, seconds, plugged, "system");
        }
        catch { return Battery(false, null, null, null, null); }
    }

    private static Dictionary<string, object?> Battery(bool available, object? percent, object? seconds, object? plugged, object? source) =>
        new(StringComparer.Ordinal) { ["available"] = available, ["percent"] = percent, ["seconds_left"] = seconds, ["power_plugged"] = plugged, ["source"] = source };

    private static Dictionary<string, object?> EmptySensors() => new(StringComparer.Ordinal) { ["available"] = false, ["temperatures"] = new List<object?>(), ["fans"] = new List<object?>(), ["battery"] = Battery(false, null, null, null, null), ["readings"] = new List<object?>() };
    private static Dictionary<string, object?> LegacyTemperature(Dictionary<string, object?> reading) => new() { ["label"] = reading.GetValueOrDefault("name"), ["current_c"] = reading.GetValueOrDefault("value"), ["minimum_c"] = reading.GetValueOrDefault("minimum"), ["maximum_c"] = reading.GetValueOrDefault("maximum"), ["critical_c"] = reading.GetValueOrDefault("critical") };
    private static Dictionary<string, object?> LegacyFan(Dictionary<string, object?> reading) => new() { ["label"] = reading.GetValueOrDefault("name"), ["current_rpm"] = reading.GetValueOrDefault("value") };

    private static IEnumerable<DriveInfo> SafeDrives()
    {
        try { return DriveInfo.GetDrives().Where(drive => drive.DriveType != DriveType.Network && drive.IsReady).ToArray(); }
        catch { return []; }
    }

    private static List<double> ReadProcessorCounter(string counter, string? instance = null, string category = "Processor")
    {
        if (!OperatingSystem.IsWindows()) return [];
        try
        {
            string[] instances = instance is not null ? [instance] : new PerformanceCounterCategory(category).GetInstanceNames().Where(name => name != "_Total").ToArray();
            return instances.Select(item => ReadCounter(category, counter, item)).Where(value => value is not null).Select(value => value!.Value).ToList();
        }
        catch { return []; }
    }

    private static double? ReadCounter(string category, string counter, string instance)
    {
        if (!OperatingSystem.IsWindows()) return null;
        try
        {
            using var performance = new PerformanceCounter(category, counter, instance, true);
            _ = performance.NextValue();
            Thread.Sleep(50);
            var value = performance.NextValue();
            return double.IsFinite(value) ? value : null;
        }
        catch { return null; }
    }

    private static long? ReadRawCounter(string category, string counter, string instance)
    {
        if (!OperatingSystem.IsWindows()) return null;
        try
        {
            using var performance = new PerformanceCounter(category, counter, instance, true);
            var value = performance.NextSample().RawValue;
            return value >= 0 ? value : null;
        }
        catch { return null; }
    }

    private static long? ToMilliseconds(long? value) => value is null ? null : value.Value / 10_000;

    private static bool TryGetMemory(out long total, out long available, out long used, out long free, out long swapTotal, out long swapAvailable)
    {
        total = available = used = free = swapTotal = swapAvailable = 0;
        try
        {
            if (OperatingSystem.IsWindows() && TryGetGlobalMemoryStatus(out var memory))
            {
                total = (long)memory.ullTotalPhys; available = (long)memory.ullAvailPhys; used = total - available; free = available;
                TryGetSwap(out swapTotal, out swapAvailable);
                return true;
            }
            var info = GC.GetGCMemoryInfo(); total = info.TotalAvailableMemoryBytes; available = info.TotalAvailableMemoryBytes - info.HeapSizeBytes; used = info.HeapSizeBytes; free = available; return total > 0;
        }
        catch { return false; }
    }

    private static void TryGetSwap(out long total, out long available)
    {
        total = available = 0;
        try
        {
            var information = new PERFORMANCE_INFORMATION { Size = (uint)Marshal.SizeOf<PERFORMANCE_INFORMATION>() };
            if (!GetPerformanceInfo(ref information, information.Size)) return;
            var pageSize = information.PageSize.ToUInt64();
            var commitLimit = information.CommitLimit.ToUInt64();
            var commitTotal = information.CommitTotal.ToUInt64();
            var physicalTotal = information.PhysicalTotal.ToUInt64();
            var totalPages = commitLimit > physicalTotal ? commitLimit - physicalTotal : 0;
            var freePages = commitLimit > commitTotal ? commitLimit - commitTotal : 0;
            total = checked((long)(totalPages * pageSize));
            available = checked((long)(Math.Min(freePages, totalPages) * pageSize));
        }
        catch { total = available = 0; }
    }

    private static int? TryGetPhysicalCoreCount()
    {
        if (!OperatingSystem.IsWindows()) return null;
        try
        {
            uint length = 0;
            _ = GetLogicalProcessorInformationEx(0, IntPtr.Zero, ref length);
            if (length == 0) return null;
            var buffer = Marshal.AllocHGlobal((int)length);
            try
            {
                if (!GetLogicalProcessorInformationEx(0, buffer, ref length)) return null;
                var count = 0;
                var offset = 0;
                var bufferLength = checked((int)length);
                while (offset + 8 <= bufferLength)
                {
                    var relationship = Marshal.ReadInt32(buffer, offset);
                    var size = Marshal.ReadInt32(buffer, offset + 4);
                    if (size < 8 || offset + size > bufferLength) break;
                    if (relationship == 0) count++;
                    offset += size;
                }
                return count > 0 ? count : null;
            }
            finally { Marshal.FreeHGlobal(buffer); }
        }
        catch { return null; }
    }

    private static Dictionary<string, object?> Group(bool available, params (string Key, object? Value)[] values)
    {
        var group = new Dictionary<string, object?>(StringComparer.Ordinal) { ["available"] = available };
        foreach (var value in values) group[value.Key] = value.Value;
        return group;
    }

    private static double? ToDouble(object? value)
    {
        try
        {
            if (value is null) return null;
            var number = Convert.ToDouble(value, System.Globalization.CultureInfo.InvariantCulture);
            return double.IsFinite(number) ? number : null;
        }
        catch { return null; }
    }

    private static Dictionary<string, object?> Mask(Dictionary<string, object?> snapshot, IReadOnlySet<string> fields)
    {
        if (snapshot.GetValueOrDefault("system") is Dictionary<string, object?> system && !MetricFields.Requested(fields, "system.boot_time"))
        { system["available"] = false; system["boot_time"] = null; }
        if (snapshot.GetValueOrDefault("cpu") is Dictionary<string, object?> cpu)
        {
            if (cpu["utilization"] is Dictionary<string, object?> utilization)
            {
                if (!MetricFields.Requested(fields, "cpu.utilization")) utilization["available"] = false;
                if (!MetricFields.Requested(fields, "cpu.utilization.overall")) utilization["overall"] = null;
                if (!MetricFields.Requested(fields, "cpu.utilization.per_core")) utilization["per_core"] = new List<object?>();
            }
            if (cpu["cores"] is Dictionary<string, object?> cores)
            { if (!MetricFields.Requested(fields, "cpu.cores")) cores["available"] = false; if (!MetricFields.Requested(fields, "cpu.cores.physical")) cores["physical"] = null; if (!MetricFields.Requested(fields, "cpu.cores.logical")) cores["logical"] = null; }
            if (cpu["frequencies"] is Dictionary<string, object?> frequency)
            { if (!MetricFields.Requested(fields, "cpu.frequencies")) frequency["available"] = false; if (!MetricFields.Requested(fields, "cpu.frequencies.current_mhz")) frequency["current_mhz"] = null; if (!MetricFields.Requested(fields, "cpu.frequencies.minimum_mhz")) frequency["minimum_mhz"] = null; if (!MetricFields.Requested(fields, "cpu.frequencies.maximum_mhz")) frequency["maximum_mhz"] = null; if (!MetricFields.Requested(fields, "cpu.frequencies.per_core")) frequency["per_core"] = new List<object?>(); }
            if (cpu["telemetry"] is Dictionary<string, object?> telemetry)
            { if (!MetricFields.Requested(fields, "cpu.telemetry")) telemetry["available"] = false; foreach (var key in new[] { "interrupts", "system_calls", "context_switches" }) telemetry[key] = null; }
            if (cpu["load_average"] is Dictionary<string, object?> load)
            { if (!MetricFields.Requested(fields, "cpu.load_average")) load["available"] = false; foreach (var key in new[] { "one_minute", "five_minutes", "fifteen_minutes" }) load[key] = null; }
        }
        if (snapshot.GetValueOrDefault("memory") is Dictionary<string, object?> memory)
        {
            if (memory["virtual"] is Dictionary<string, object?> virtualMemory) foreach (var (field, key) in new[] { ("total_bytes", "memory.virtual.total_bytes"), ("available_bytes", "memory.virtual.available_bytes"), ("used_bytes", "memory.virtual.used_bytes"), ("free_bytes", "memory.virtual.free_bytes"), ("percent", "memory.virtual.percent") }) if (!MetricFields.Requested(fields, key)) virtualMemory[field] = null;
            if (memory["swap"] is Dictionary<string, object?> swap) foreach (var (field, key) in new[] { ("total_bytes", "memory.swap.total_bytes"), ("used_bytes", "memory.swap.used_bytes"), ("free_bytes", "memory.swap.free_bytes"), ("percent", "memory.swap.percent") }) if (!MetricFields.Requested(fields, key)) swap[field] = null;
        if (memory["virtual"] is Dictionary<string, object?> virtualGroup && !MetricFields.Requested(fields, "memory.virtual")) virtualGroup["available"] = false;
        if (memory["swap"] is Dictionary<string, object?> swapGroup && !MetricFields.Requested(fields, "memory.swap")) swapGroup["available"] = false;
        memory["available"] = memory["virtual"] is Dictionary<string, object?> availableVirtual && availableVirtual["available"] is true
            || memory["swap"] is Dictionary<string, object?> availableSwap && availableSwap["available"] is true;
        }
        if (snapshot.GetValueOrDefault("disks") is Dictionary<string, object?> disks)
        {
            if (!MetricFields.Requested(fields, "disks.partitions")) disks["partitions"] = new List<object?>();
            if (!MetricFields.Requested(fields, "disks.usage")) disks["usage"] = new List<object?>();
            if (disks["io"] is Dictionary<string, object?> io)
                foreach (var (field, key) in new[] { ("read_count", "disks.io.read_count"), ("write_count", "disks.io.write_count"), ("read_bytes", "disks.io.read_bytes"), ("write_bytes", "disks.io.write_bytes"), ("read_time_ms", "disks.io.read_time_ms"), ("write_time_ms", "disks.io.write_time_ms"), ("busy_time_ms", "disks.io.busy_time_ms") })
                    if (!MetricFields.Requested(fields, key)) io[field] = null;
            if (disks["io"] is Dictionary<string, object?> diskGroup && !MetricFields.Requested(fields, "disks.io")) diskGroup["available"] = false;
            disks["available"] = disks["partitions"] is List<object?> partitionValues && partitionValues.Count > 0
                || disks["usage"] is List<object?> usageValues && usageValues.Count > 0
                || disks["io"] is Dictionary<string, object?> availableIo && availableIo["available"] is true;
        }
        if (snapshot.GetValueOrDefault("network") is Dictionary<string, object?> network)
        {
            foreach (var (field, key) in new[] { ("bytes_sent", "network.bytes_sent"), ("bytes_received", "network.bytes_received"), ("packets_dropped", "network.packets_dropped"), ("transmission_errors", "network.transmission_errors") }) if (!MetricFields.Requested(fields, key)) network[field] = null;
            if (!MetricFields.Requested(fields, "network")) network["available"] = false;
        }
        if (snapshot.GetValueOrDefault("sensors") is Dictionary<string, object?> sensors)
        { if (!MetricFields.Requested(fields, "sensors.temperatures") && !MetricFields.Requested(fields, "sensors.readings")) sensors["temperatures"] = new List<object?>(); if (!MetricFields.Requested(fields, "sensors.fans") && !MetricFields.Requested(fields, "sensors.readings")) sensors["fans"] = new List<object?>(); if (!MetricFields.Requested(fields, "sensors.battery")) sensors["battery"] = Battery(false, null, null, null, null); if (!MetricFields.Requested(fields, "sensors.readings")) sensors["readings"] = new List<object?>(); if (!MetricFields.Requested(fields, "sensors")) sensors["available"] = false; }
        return snapshot;
    }

    private static Dictionary<string, object?> DeepCopy(Dictionary<string, object?> source) =>
        source.ToDictionary(pair => pair.Key, pair => DeepCopyValue(pair.Value), StringComparer.Ordinal);

    private static object? DeepCopyValue(object? value) => value switch
    {
        Dictionary<string, object?> dictionary => DeepCopy(dictionary),
        List<object?> list => list.Select(DeepCopyValue).ToList(),
        _ => value,
    };

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct MEMORYSTATUSEX
    {
        public uint dwLength; public uint dwMemoryLoad; public ulong ullTotalPhys; public ulong ullAvailPhys; public ulong ullTotalPageFile; public ulong ullAvailPageFile; public ulong ullTotalVirtual; public ulong ullAvailVirtual; public ulong ullAvailExtendedVirtual;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct SYSTEM_POWER_STATUS
    { public byte ACLineStatus; public byte BatteryFlag; public byte BatteryLifePercent; public byte Reserved1; public uint BatteryLifeTime; public uint BatteryFullLifeTime; }

    [StructLayout(LayoutKind.Sequential)]
    private struct PERFORMANCE_INFORMATION
    {
        public uint Size;
        public UIntPtr CommitTotal;
        public UIntPtr CommitLimit;
        public UIntPtr CommitPeak;
        public UIntPtr PhysicalTotal;
        public UIntPtr PhysicalAvailable;
        public UIntPtr SystemCache;
        public UIntPtr KernelTotal;
        public UIntPtr KernelPaged;
        public UIntPtr KernelNonpaged;
        public UIntPtr PageSize;
        public uint HandlesCount;
        public uint ProcessCount;
        public uint ThreadCount;
    }

    [DllImport("kernel32.dll")]
    private static extern ulong GetTickCount64();
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);
    private static bool TryGetGlobalMemoryStatus(out MEMORYSTATUSEX value) { value = new MEMORYSTATUSEX { dwLength = (uint)Marshal.SizeOf<MEMORYSTATUSEX>() }; return GlobalMemoryStatusEx(ref value); }
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetLogicalProcessorInformationEx(int relationship, IntPtr buffer, ref uint returnedLength);
    [DllImport("psapi.dll", SetLastError = true)]
    private static extern bool GetPerformanceInfo(ref PERFORMANCE_INFORMATION performanceInformation, uint size);
    [DllImport("kernel32.dll")]
    private static extern bool GetSystemPowerStatus(out SYSTEM_POWER_STATUS systemPowerStatus);
}
