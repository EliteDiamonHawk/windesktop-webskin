using WebSkin.Backend.Infrastructure;
using WebSkin.Backend.Metrics;

namespace WebSkin.Backend.Tests;

public sealed class MetricsTests
{
    [Fact]
    public void Field_parser_rejects_unknown_fields_and_stream_empty_selection()
    {
        Assert.Throws<MetricValidationException>(() => MetricFields.Parse("memory.private.secret"));
        Assert.Throws<MetricValidationException>(() => MetricFields.Parse("cpu.telemetry"));
        Assert.Throws<MetricValidationException>(() => MetricFields.Parse("cpu.telemetry.interrupts"));
        Assert.Throws<MetricValidationException>(() => MetricFields.Parse("cpu.load_average"));
        Assert.Throws<MetricValidationException>(() => MetricFields.Parse("cpu.load_average.one_minute"));
        Assert.Throws<MetricValidationException>(() => MetricFields.Parse("", stream: true));
        Assert.Equal(2, MetricFields.ValidateInterval(2));
        Assert.Throws<MetricValidationException>(() => MetricFields.ValidateInterval(3601));
    }

    [Fact]
    public async Task Subscription_delivers_initial_snapshot_and_keeps_latest_message()
    {
        var provider = new FakeMetricsProvider();
        using var manager = new MetricSubscriptionManager(provider);
        var subscription = await manager.SubscribeAsync(new HashSet<string> { "memory.virtual.percent" }, 1);

        var first = await subscription.ReceiveAsync(new CancellationTokenSource(TimeSpan.FromSeconds(2)).Token);
        Assert.Equal("snapshot", first!["type"]);
        subscription.Publish(new Dictionary<string, object?> { ["type"] = "snapshot", ["sequence"] = 1 });
        subscription.Publish(new Dictionary<string, object?> { ["type"] = "snapshot", ["sequence"] = 2 });
        Assert.Equal(2, (await subscription.ReceiveAsync(new CancellationTokenSource(TimeSpan.FromSeconds(2)).Token))!["sequence"]);
    }

    [Fact]
    public void Projection_masks_unrequested_disk_io_values()
    {
        using var service = new SystemMetricsService(new FakeHardwareMonitor(), new FakeClock());
        var snapshot = new Dictionary<string, object?>
        {
            ["disks"] = new Dictionary<string, object?>
            {
                ["available"] = true,
                ["partitions"] = new List<object?>(),
                ["usage"] = new List<object?>(),
                ["io"] = new Dictionary<string, object?>
                {
                    ["available"] = false,
                    ["read_count"] = 10L,
                    ["write_count"] = 20L,
                    ["read_bytes"] = 30L,
                    ["write_bytes"] = 40L,
                    ["read_time_ms"] = 50L,
                    ["write_time_ms"] = 60L,
                    ["busy_time_ms"] = 70L,
                },
            },
        };

        var result = service.ProjectSnapshot(snapshot, new HashSet<string> { "disks.io.read_count" });
        var io = (Dictionary<string, object?>)((Dictionary<string, object?>)result["disks"]!)["io"]!;

        Assert.Null(io["read_count"]);
        Assert.Null(io["write_count"]);
        Assert.Null(io["read_bytes"]);
        Assert.False((bool)((Dictionary<string, object?>)result["disks"]!)["available"]!);
    }

    [Fact]
    public async Task Cpu_snapshot_omits_unsupported_metric_groups()
    {
        using var service = new SystemMetricsService(new FakeHardwareMonitor(), new FakeClock());
        var snapshot = await service.CollectAsync(new HashSet<string> { "cpu.utilization.overall" });
        var cpu = (Dictionary<string, object?>)snapshot["cpu"]!;

        Assert.False(cpu.ContainsKey("telemetry"));
        Assert.False(cpu.ContainsKey("load_average"));
    }

    private sealed class FakeMetricsProvider : ISystemMetricsProvider
    {
        public IReadOnlySet<string> SupportedFields => MetricFields.Supported;
        public Task<Dictionary<string, object?>> CollectAsync(IReadOnlySet<string>? requestedFields, CancellationToken cancellationToken = default) =>
            Task.FromResult(new Dictionary<string, object?> { ["timestamp"] = "test", ["fields"] = requestedFields });
        public Dictionary<string, object?> ProjectSnapshot(Dictionary<string, object?> snapshot, IReadOnlySet<string>? requestedFields) => new(snapshot);
    }

    private sealed class FakeHardwareMonitor : IHardwareMonitor
    {
        public HardwareSnapshot Read() => new(false, []);
        public void Dispose() { }
    }

    private sealed class FakeClock : IClock
    {
        public DateTimeOffset UtcNow => DateTimeOffset.UnixEpoch;
        public double MonotonicSeconds => 0;
    }
}
