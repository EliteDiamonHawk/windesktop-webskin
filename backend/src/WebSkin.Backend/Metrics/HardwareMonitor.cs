using LibreHardwareMonitor.Hardware;
using Microsoft.Extensions.Logging;
using WebSkin.Backend.Infrastructure;

namespace WebSkin.Backend.Metrics;

public interface IHardwareMonitor : IDisposable
{
    HardwareSnapshot Read();
}

public sealed record HardwareSnapshot(bool Available, IReadOnlyList<Dictionary<string, object?>> Readings);

public sealed class HardwareMonitor : IHardwareMonitor
{
    private static readonly Dictionary<string, string> Units = new(StringComparer.OrdinalIgnoreCase)
    {
        ["temperature"] = "°C", ["fan"] = "RPM", ["voltage"] = "V", ["power"] = "W",
        ["current"] = "A", ["clock"] = "MHz", ["frequency"] = "MHz", ["load"] = "%",
        ["level"] = "%", ["battery"] = "%",
    };
    private readonly bool _enabled;
    private readonly IClock _clock;
    private readonly ILogger<HardwareMonitor> _logger;
    private readonly object _gate = new();
    private readonly double _cacheTtl = 1;
    private readonly double _failureCooldown = 30;
    private Computer? _computer;
    private bool _initializationAttempted;
    private double _unavailableUntil;
    private double _cachedAt = double.MinValue;
    private IReadOnlyList<Dictionary<string, object?>> _cachedReadings = [];

    public HardwareMonitor(bool enabled, IClock clock, ILogger<HardwareMonitor> logger)
    {
        _enabled = enabled;
        _clock = clock;
        _logger = logger;
    }

    public HardwareSnapshot Read()
    {
        lock (_gate)
        {
            if (!_enabled) return new HardwareSnapshot(false, []);
            var now = _clock.MonotonicSeconds;
            if (_cachedAt != double.MinValue && now - _cachedAt < _cacheTtl)
                return new HardwareSnapshot(_cachedReadings.Count > 0, Clone(_cachedReadings));

            var computer = EnsureComputer(now);
            if (computer is null) return new HardwareSnapshot(false, []);
            try
            {
                var readings = new List<Dictionary<string, object?>>();
                foreach (var hardware in computer.Hardware) VisitHardware(hardware, readings);
                _cachedAt = now;
                _cachedReadings = readings;
                return new HardwareSnapshot(readings.Count > 0, Clone(readings));
            }
            catch (Exception ex)
            {
                MarkUnavailable(now, "HardwareMonitor sensor update failed", ex);
                return new HardwareSnapshot(false, []);
            }
        }
    }

    public void Dispose()
    {
        lock (_gate)
        {
            if (_computer is null) return;
            try { _computer.Close(); }
            catch (Exception ex) { _logger.LogWarning(ex, "HardwareMonitor shutdown failed"); }
            finally { _computer = null; }
        }
    }

    private Computer? EnsureComputer(double now)
    {
        if (_unavailableUntil > now) return null;
        if (_unavailableUntil > 0)
        {
            _unavailableUntil = 0;
            _initializationAttempted = false;
        }
        if (_computer is not null) return _computer;
        if (_initializationAttempted) return null;
        _initializationAttempted = true;
        try
        {
            var computer = new Computer
            {
                IsCpuEnabled = true,
                IsGpuEnabled = true,
                IsMemoryEnabled = true,
                IsMotherboardEnabled = true,
                IsControllerEnabled = true,
                IsNetworkEnabled = true,
                IsStorageEnabled = true,
                IsPowerMonitorEnabled = true,
            };
            computer.Open();
            _computer = computer;
            return computer;
        }
        catch (Exception ex)
        {
            MarkUnavailable(now, "HardwareMonitor could not be initialized", ex);
            return null;
        }
    }

    private void VisitHardware(IHardware hardware, List<Dictionary<string, object?>> readings)
    {
        hardware.Update();
        var hardwareId = hardware.Identifier.ToString();
        var hardwareName = hardware.Name ?? hardwareId;
        var hardwareType = Normalize(hardware.HardwareType.ToString());
        for (var index = 0; index < hardware.Sensors.Length; index++)
        {
            var sensor = hardware.Sensors[index];
            var type = Normalize(sensor.SensorType.ToString());
            readings.Add(new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["id"] = sensor.Identifier.ToString(),
                ["hardware_id"] = hardwareId,
                ["hardware_name"] = hardwareName,
                ["hardware_type"] = hardwareType,
                ["name"] = string.IsNullOrWhiteSpace(sensor.Name) ? $"{type}-{index + 1}" : sensor.Name,
                ["type"] = type,
                ["value"] = Number(sensor.Value),
                ["unit"] = Units.GetValueOrDefault(type, string.Empty),
                ["minimum"] = Number(sensor.Min),
                ["maximum"] = Number(sensor.Max),
                ["warning"] = null,
                ["critical"] = null,
                ["source"] = "hardware_monitor",
            });
        }
        foreach (var child in hardware.SubHardware) VisitHardware(child, readings);
    }

    private void MarkUnavailable(double now, string message, Exception exception)
    {
        _unavailableUntil = now + _failureCooldown;
        _logger.LogWarning(exception, message);
    }

    private static string Normalize(string value)
    {
        var text = value.Contains('.') ? value[(value.LastIndexOf('.') + 1)..] : value;
        if (text.EndsWith("Type", StringComparison.OrdinalIgnoreCase)) text = text[..^4];
        return text.Replace(' ', '_').Replace('-', '_').ToLowerInvariant();
    }

    private static object? Number(float? value)
    {
        if (value is null || float.IsNaN(value.Value) || float.IsInfinity(value.Value)) return null;
        return value.Value;
    }

    private static IReadOnlyList<Dictionary<string, object?>> Clone(IReadOnlyList<Dictionary<string, object?>> source) =>
        source.Select(item => new Dictionary<string, object?>(item, StringComparer.Ordinal)).ToArray();
}
