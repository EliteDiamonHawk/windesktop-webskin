using System.Text.Json.Nodes;
using WebSkin.Backend.Infrastructure;

namespace WebSkin.Backend.Services;

public sealed class SettingNotFoundException(string key) : Exception(key);

public sealed class SettingsService
{
    public static readonly IReadOnlySet<string> CommonWidgetIds = new HashSet<string>(StringComparer.Ordinal)
    {
        "last-boot-plain", "battery-plain", "cpu-utilization-plain", "cpu-utilization-list-plain",
        "cpu-core-counts-plain", "cpu-frequency-plain",
        "memory-plain", "swap-memory-plain", "disk-io-plain", "network-telemetry-plain",
        "disk-partitions-plain", "gpu-thermal-fan-plain", "network-telemetry-transfer-plain",
        "battery-prestyled", "cpu-utilization-prestyled", "cpu-core-counts-prestyled", "cpu-frequency-prestyled",
        "memory-prestyled", "swap-memory-prestyled", "disk-usage-prestyled",
        "network-prestyled", "gpu-temperature-prestyled", "last-boot-prestyled", "digital-plain",
        "digital-prestyled", "digital-prestyled2", "analog-plain", "analog-prestyled", "analog-prestyled2",
        "digital-analog-prestyled", "digital-day", "rainmeter-mond-clock-remake", "day-plain", "day-prestyled",
        "day-prestyled2", "week-plain", "week-prestyled", "month-plain", "month-prestyled",
    };

    private static readonly IReadOnlyDictionary<string, (string Family, string AppKey, int Fallback)> TimeIntervals =
        BuildIntervals(("clock", "time_clock_update_interval_seconds", 5,
            ["digital-plain", "digital-prestyled", "digital-prestyled2", "analog-plain", "analog-prestyled", "analog-prestyled2", "digital-analog-prestyled", "digital-day", "rainmeter-mond-clock-remake"]),
            ("calendar", "time_calendar_update_interval_seconds", 60,
            ["day-plain", "day-prestyled", "day-prestyled2", "week-plain", "week-prestyled", "month-plain", "month-prestyled"]));

    private static readonly IReadOnlyDictionary<string, (string Family, string AppKey, int Fallback)> SystemIntervals =
        BuildIntervals(("fast", "system_fast_update_interval_seconds", 5,
            ["cpu-utilization-plain", "cpu-utilization-list-plain", "disk-io-plain", "network-telemetry-plain", "network-telemetry-transfer-plain", "gpu-thermal-fan-plain", "cpu-utilization-prestyled", "network-prestyled", "gpu-temperature-prestyled"]),
            ("standard", "system_standard_update_interval_seconds", 30,
            ["memory-plain", "swap-memory-plain", "battery-plain", "cpu-frequency-plain", "memory-prestyled", "swap-memory-prestyled", "battery-prestyled", "cpu-frequency-prestyled"]),
            ("slow", "system_slow_update_interval_seconds", 60,
            ["cpu-core-counts-plain", "disk-partitions-plain", "cpu-core-counts-prestyled", "disk-usage-prestyled", "last-boot-prestyled"]));

    private readonly ISettingsStorage _storage;

    public SettingsService(ISettingsStorage storage) => _storage = storage;

    public JsonObject Get(string namespaceName, string? key = null, string? identifier = null)
    {
        if (key is null) return _storage.GetNamespace(namespaceName, identifier);
        var value = _storage.GetValue(namespaceName, key, identifier, out var found);
        if (!found) throw new SettingNotFoundException(key);
        return new JsonObject { ["value"] = value };
    }

    public JsonNode? GetValue(string namespaceName, string key, string? identifier = null)
    {
        var value = _storage.GetValue(namespaceName, key, identifier, out var found);
        if (!found) throw new SettingNotFoundException(key);
        return value;
    }

    public JsonNode? Set(string namespaceName, string key, JsonNode? value, string? identifier = null)
    {
        _storage.SetValue(namespaceName, key, value, identifier);
        return value;
    }

    public void Delete(string namespaceName, string key, string? identifier = null)
    {
        if (!_storage.DeleteValue(namespaceName, key, identifier)) throw new SettingNotFoundException(key);
    }

    public bool IsValidWidget(string identifier) => IsValidScopedIdentifier(identifier);

    public bool IsValidTheme(string identifier) => IsValidScopedIdentifier(identifier);

    private static bool IsValidScopedIdentifier(string identifier) =>
        !string.IsNullOrEmpty(identifier) && identifier is not "." and not ".."
        && !identifier.Contains('/') && !identifier.Contains('\\') && !identifier.Contains('\0');

    public bool HardwareMonitorEnabled
    {
        get
        {
            try
            {
                var value = GetValue("app", "hardware_monitor_enabled");
                return value is JsonValue json && json.TryGetValue<bool>(out var enabled) ? enabled : true;
            }
            catch (SettingNotFoundException) { return true; }
            catch (SettingsStorageException) { return true; }
        }
    }

    public Dictionary<string, object?> ResolveTimeWidgetIntervals() => ResolveIntervals(TimeIntervals, ["clock", "calendar"]);
    public Dictionary<string, object?> ResolveSystemWidgetIntervals() => ResolveIntervals(SystemIntervals, ["fast", "standard", "slow"]);

    private Dictionary<string, object?> ResolveIntervals(
        IReadOnlyDictionary<string, (string Family, string AppKey, int Fallback)> definitions,
        string[] familyOrder)
    {
        var defaults = new Dictionary<string, int>(StringComparer.Ordinal);
        var widgets = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var item in definitions)
        {
            if (!defaults.TryGetValue(item.Value.Family, out var familyDefault))
            {
                familyDefault = ReadPositiveInteger("app", item.Value.AppKey) ?? item.Value.Fallback;
                defaults[item.Value.Family] = familyDefault;
            }

            widgets[item.Key] = ReadPositiveInteger("widgets", "updateInterval", item.Key) ?? familyDefault;
        }

        var response = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var family in familyOrder) response[family] = defaults[family];
        response["widgets"] = widgets;
        return response;
    }

    private int? ReadPositiveInteger(string namespaceName, string key, string? identifier = null)
    {
        try
        {
            var value = GetValue(namespaceName, key, identifier);
            return value is JsonValue json && json.TryGetValue<int>(out var number) && number > 0 ? number : null;
        }
        catch (SettingNotFoundException) { return null; }
    }

    private static IReadOnlyDictionary<string, (string Family, string AppKey, int Fallback)> BuildIntervals(
        params (string Family, string AppKey, int Fallback, string[] Widgets)[] groups)
    {
        var result = new Dictionary<string, (string, string, int)>(StringComparer.Ordinal);
        foreach (var group in groups)
            foreach (var widget in group.Widgets)
                result[widget] = (group.Family, group.AppKey, group.Fallback);
        return result;
    }
}
