using WebSkin.Backend.Infrastructure;
using WebSkin.Backend.Metrics;

namespace WebSkin.Backend.Tests;

public sealed class MetricsTests
{
    [Fact]
    public void Field_parser_rejects_unknown_fields_and_stream_empty_selection()
    {
        Assert.Throws<MetricValidationException>(() => MetricFields.Parse("memory.private.secret"));
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

    private sealed class FakeMetricsProvider : ISystemMetricsProvider
    {
        public IReadOnlySet<string> SupportedFields => MetricFields.Supported;
        public Task<Dictionary<string, object?>> CollectAsync(IReadOnlySet<string>? requestedFields, CancellationToken cancellationToken = default) =>
            Task.FromResult(new Dictionary<string, object?> { ["timestamp"] = "test", ["fields"] = requestedFields });
        public Dictionary<string, object?> ProjectSnapshot(Dictionary<string, object?> snapshot, IReadOnlySet<string>? requestedFields) => new(snapshot);
    }
}
