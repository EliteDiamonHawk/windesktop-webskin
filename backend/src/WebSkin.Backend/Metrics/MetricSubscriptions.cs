using System.Diagnostics;
using System.Threading.Channels;

namespace WebSkin.Backend.Metrics;

public interface IMetricsSubscriptionManager : IDisposable
{
    Task<MetricSubscription> SubscribeAsync(IReadOnlySet<string>? fields, int interval, CancellationToken cancellationToken = default);
}

public sealed class MetricSubscriptionManager : IMetricsSubscriptionManager
{
    private readonly ISystemMetricsProvider _provider;
    private readonly object _gate = new();
    private readonly HashSet<MetricSubscription> _subscriptions = [];
    private readonly SemaphoreSlim _wake = new(0, 1);
    private readonly CancellationTokenSource _shutdown = new();
    private Task? _scheduler;
    private bool _closed;

    public MetricSubscriptionManager(ISystemMetricsProvider provider) => _provider = provider;

    public Task<MetricSubscription> SubscribeAsync(IReadOnlySet<string>? fields, int interval, CancellationToken cancellationToken = default)
    {
        if (fields is not null && (fields.Count == 0 || fields.Count > MetricFields.MaxFields)) throw new MetricValidationException($"fields must contain between 1 and {MetricFields.MaxFields} supported metric fields");
        if (fields is not null)
        {
            var invalid = fields.Except(_provider.SupportedFields).OrderBy(field => field, StringComparer.Ordinal).FirstOrDefault();
            if (invalid is not null) throw new MetricValidationException($"Unsupported system metric field: {invalid}");
        }
        if (interval is < MetricFields.MinInterval or > MetricFields.MaxInterval) throw new MetricValidationException($"interval must be an integer from {MetricFields.MinInterval} through {MetricFields.MaxInterval}");
        lock (_gate)
        {
            if (_closed) throw new InvalidOperationException("metric subscriptions are closed");
            if (_subscriptions.Count >= MetricFields.MaxSubscriptions) throw new InvalidOperationException("metric subscription limit reached");
            var subscription = new MetricSubscription(this, fields is null ? null : fields.ToHashSet(StringComparer.Ordinal), interval);
            _subscriptions.Add(subscription);
            _scheduler ??= Task.Run(ScheduleAsync);
            Signal();
            return Task.FromResult(subscription);
        }
    }

    internal void Remove(MetricSubscription subscription)
    {
        lock (_gate) _subscriptions.Remove(subscription);
        Signal();
    }

    public void Dispose()
    {
        lock (_gate)
        {
            if (_closed) return;
            _closed = true;
            foreach (var subscription in _subscriptions.ToArray()) subscription.Close();
            _subscriptions.Clear();
        }
        _shutdown.Cancel();
        Signal();
        try { _scheduler?.GetAwaiter().GetResult(); } catch (OperationCanceledException) { }
        _shutdown.Dispose();
        _wake.Dispose();
    }

    private async Task ScheduleAsync()
    {
        var due = new Dictionary<MetricSubscription, double>();
        try
        {
            while (!_shutdown.IsCancellationRequested)
            {
                MetricSubscription[] active;
                lock (_gate) active = _subscriptions.ToArray();
                if (active.Length == 0)
                {
                    await WaitForSignalAsync(Timeout.Infinite, _shutdown.Token);
                    continue;
                }

                var now = Stopwatch.GetTimestamp() / (double)Stopwatch.Frequency;
                foreach (var subscription in active) if (!due.ContainsKey(subscription)) due[subscription] = now;
                foreach (var item in due.Keys.Where(subscription => !active.Contains(subscription)).ToArray()) due.Remove(item);
                var next = due.Values.Min();
                var waitMilliseconds = Math.Max(0, (int)Math.Ceiling((next - now) * 1000));
                if (waitMilliseconds > 0)
                {
                    await WaitForSignalAsync(waitMilliseconds, _shutdown.Token);
                    continue;
                }

                var ready = active.Where(subscription => due[subscription] <= now).ToArray();
                foreach (var subscription in ready) due[subscription] = now + subscription.Interval;
                if (ready.Length == 0) continue;
                IReadOnlySet<string>? fields = new HashSet<string>(StringComparer.Ordinal);
                if (ready.Any(subscription => subscription.Fields is null)) fields = null;
                else fields = ready.SelectMany(subscription => subscription.Fields!).ToHashSet(StringComparer.Ordinal);

                Dictionary<string, object?> snapshot;
                try { snapshot = await _provider.CollectAsync(fields, _shutdown.Token); }
                catch
                {
                    foreach (var subscription in ready) subscription.Publish(new Dictionary<string, object?> { ["type"] = "error", ["code"] = "collection_failed", ["message"] = "System metric collection failed" });
                    continue;
                }
                foreach (var subscription in ready)
                {
                    subscription.Publish(new Dictionary<string, object?>
                    {
                        ["type"] = "snapshot",
                        ["data"] = _provider.ProjectSnapshot(snapshot, subscription.Fields),
                    });
                }
            }
        }
        catch (OperationCanceledException) when (_shutdown.IsCancellationRequested) { }
    }

    private async Task WaitForSignalAsync(int milliseconds, CancellationToken cancellationToken)
    {
        if (milliseconds == Timeout.Infinite) { await _wake.WaitAsync(cancellationToken); return; }
        var signal = _wake.WaitAsync(cancellationToken);
        var delay = Task.Delay(milliseconds, cancellationToken);
        await Task.WhenAny(signal, delay);
        if (signal.IsCompletedSuccessfully) _wake.Wait(0);
    }

    private void Signal() { try { _wake.Release(); } catch (SemaphoreFullException) { } catch (ObjectDisposedException) { } }
}

public sealed class MetricSubscription
{
    private readonly MetricSubscriptionManager _manager;
    private readonly Channel<Dictionary<string, object?>> _messages = Channel.CreateBounded<Dictionary<string, object?>>(new BoundedChannelOptions(1) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = false, SingleWriter = false });
    private int _closed;

    internal MetricSubscription(MetricSubscriptionManager manager, IReadOnlySet<string>? fields, int interval)
    { _manager = manager; Fields = fields; Interval = interval; }

    public IReadOnlySet<string>? Fields { get; }
    public int Interval { get; }
    public bool Closed => Volatile.Read(ref _closed) != 0;

    public void Publish(Dictionary<string, object?> message)
    {
        if (Closed) return;
        _messages.Writer.TryWrite(message);
    }

    public async ValueTask<Dictionary<string, object?>?> ReceiveAsync(CancellationToken cancellationToken)
    {
        try
        {
            if (await _messages.Reader.WaitToReadAsync(cancellationToken) && _messages.Reader.TryRead(out var message)) return message;
        }
        catch (ChannelClosedException) { }
        return null;
    }

    public void Close()
    {
        if (Interlocked.Exchange(ref _closed, 1) != 0) return;
        _manager.Remove(this);
        _messages.Writer.TryComplete();
    }
}
