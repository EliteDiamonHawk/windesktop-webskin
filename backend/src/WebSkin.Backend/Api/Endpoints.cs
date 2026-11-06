using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.StaticFiles;
using WebSkin.Backend.Infrastructure;
using WebSkin.Backend.Metrics;
using WebSkin.Backend.Services;

namespace WebSkin.Backend.Api;

public static class Endpoints
{
    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    public static void MapWebSkinEndpoints(this WebApplication app, IReadOnlySet<string> allowedOrigins)
    {
        app.MapGet("/api/health", () => Results.Ok(new Dictionary<string, string> { ["status"] = "ok", ["service"] = "backend" }));
        app.MapGet("/api/status", () => Results.Ok(new Dictionary<string, string> { ["message"] = "Frontend and backend are connected." }));

        MapSettings(app);
        MapThemes(app);
        MapMetrics(app, allowedOrigins);
        MapSystem(app);
    }

    private static void MapSettings(WebApplication app)
    {
        app.MapGet("/api/settings/app", (SettingsService service) => ReadNamespace(service, "app"));
        app.MapGet("/api/settings/app/{key}", (string key, SettingsService service) => ReadValue(service, "app", key));
        app.MapPut("/api/settings/app/{key}", async (string key, HttpRequest request, SettingsService service) => await WriteValue(request, service, "app", key));
        app.MapDelete("/api/settings/app/{key}", (string key, SettingsService service) => DeleteValue(service, "app", key));

        app.MapGet("/api/settings/widgets/time-intervals", (SettingsService service) => Results.Ok(service.ResolveTimeWidgetIntervals()));
        app.MapGet("/api/settings/widgets/system-intervals", (SettingsService service) => Results.Ok(service.ResolveSystemWidgetIntervals()));

        app.MapGet("/api/settings/{namespaceName}/{identifier}", (string namespaceName, string identifier, SettingsService service) =>
            IsValidScope(namespaceName, identifier, service) ? ReadNamespace(service, namespaceName, identifier) : Detail(404, namespaceName == "widgets" ? "Widget identifier is invalid" : "Settings namespace not found"));
        app.MapGet("/api/settings/{namespaceName}/{identifier}/{key}", (string namespaceName, string identifier, string key, SettingsService service) =>
            IsValidScope(namespaceName, identifier, service) ? ReadValue(service, namespaceName, key, identifier) : Detail(404, namespaceName == "widgets" ? "Widget identifier is invalid" : "Settings namespace not found"));
        app.MapPut("/api/settings/{namespaceName}/{identifier}/{key}", async (string namespaceName, string identifier, string key, HttpRequest request, SettingsService service) =>
            IsValidScope(namespaceName, identifier, service) ? await WriteValue(request, service, namespaceName, key, identifier) : Detail(404, namespaceName == "widgets" ? "Widget identifier is invalid" : "Settings namespace not found"));
        app.MapDelete("/api/settings/{namespaceName}/{identifier}/{key}", (string namespaceName, string identifier, string key, SettingsService service) =>
            IsValidScope(namespaceName, identifier, service) ? DeleteValue(service, namespaceName, key, identifier) : Detail(404, namespaceName == "widgets" ? "Widget identifier is invalid" : "Settings namespace not found"));
    }

    private static void MapThemes(WebApplication app)
    {
        app.MapGet("/api/themes", (IThemeStorage storage) =>
        {
            try { return Results.Ok(storage.List()); }
            catch (ThemeStorageException) { return Detail(503, "Theme storage is unavailable"); }
        });
        app.MapPost("/api/themes", async (HttpRequest request, IThemeStorage storage) =>
        {
            var payload = await ReadObject(request);
            if (!TryGetString(payload, "name", out var name)) return Detail(422, "Theme name must be a string");
            try
            {
                var theme = storage.Create(name);
                return Results.Created($"/api/themes/{PathEncoding.EncodeURIComponent(theme.Id)}", theme);
            }
            catch (ThemeStorageException) { return Detail(503, "Theme storage is unavailable"); }
        });
        app.MapPost("/api/themes/{themeId}/duplicate", (string themeId, IThemeStorage storage) =>
        {
            try
            {
                var theme = storage.Duplicate(themeId);
                return Results.Created($"/api/themes/{PathEncoding.EncodeURIComponent(theme.Id)}", theme);
            }
            catch (ThemeStorageException) { return Detail(404, "Theme was not found"); }
        });
        app.MapDelete("/api/themes/{themeId}", (string themeId, IThemeStorage storage) =>
        {
            try { storage.Delete(themeId); return Results.NoContent(); }
            catch (ThemeStorageException) { return Detail(404, "Theme was not found"); }
        });
        app.MapPatch("/api/themes/{themeId}", async (string themeId, HttpRequest request, IThemeStorage storage) =>
        {
            var payload = await ReadObject(request);
            if (!TryGetString(payload, "name", out var name)) return Detail(422, "Theme name must be a string");
            try { return Results.Ok(storage.Rename(themeId, name)); }
            catch (ThemeNameConflictException ex) { return Detail(409, ex.Message); }
            catch (ThemeStorageException) { return Detail(404, "Theme was not found"); }
        });
        app.MapPut("/api/themes/{themeId}/preview", async (string themeId, HttpRequest request, IThemeStorage storage) =>
        {
            var payload = await ReadObject(request);
            if (!TryGetString(payload, "png", out var png)) return Detail(422, "Preview must be a PNG data URL");
            try { storage.SavePreview(themeId, png); return Results.NoContent(); }
            catch (ThemeStorageException ex) { return Detail(422, ex.Message); }
        });
        app.MapGet("/api/themes/{themeId}/preview", (string themeId, IThemeStorage storage) =>
        {
            try { return Results.File(storage.PreviewPath(themeId), "image/png"); }
            catch (ThemeStorageException) { return Detail(404, "Theme preview was not found"); }
        });

        app.MapGet("/common/{**relativePath}", (string? relativePath, IPathResolver paths) =>
        {
            try { return FileResult(paths.SafeAssetPath(paths.GetThemePaths().CommonRoot, relativePath ?? string.Empty)); }
            catch { return Detail(404, "Common asset was not found"); }
        });
        app.MapGet("/themes/{themeId}", (string themeId, IThemeStorage storage) => ThemeFile(themeId, string.Empty, storage));
        app.MapGet("/themes/{themeId}/{**relativePath}", (string themeId, string? relativePath, IThemeStorage storage) => ThemeFile(themeId, relativePath ?? string.Empty, storage));
    }

    private static void MapMetrics(WebApplication app, IReadOnlySet<string> allowedOrigins)
    {
        app.MapGet("/api/system/metrics", async (HttpRequest request, ISystemMetricsProvider provider) =>
        {
            try
            {
                var fields = MetricFields.Parse(request.Query["fields"].FirstOrDefault());
                return Results.Ok(await provider.CollectAsync(fields, request.HttpContext.RequestAborted));
            }
            catch (MetricValidationException ex) { return Detail(422, ex.Message); }
        });
        app.MapGet("/api/system/metrics/events", async (HttpContext context, ISystemMetricsProvider provider, IMetricsSubscriptionManager manager) =>
            await StreamEvents(context, provider, manager));
        app.Map("/api/system/metrics/ws", branch => branch.Run(context => WebSocketEvents(context, allowedOrigins)));
    }

    private static void MapSystem(WebApplication app)
    {
        app.MapGet("/api/system/time", (IClock clock) => Results.Ok(new Dictionary<string, long> { ["epochMilliseconds"] = clock.UtcNow.ToUnixTimeMilliseconds() }));
        app.MapPost("/api/system/controls/{control}", (string control, IProcessRunner runner, ILoggerFactory loggerFactory) =>
        {
            try { runner.Execute(control, loggerFactory.CreateLogger("SystemControls")); return Results.NoContent(); }
            catch (KeyNotFoundException) { return Detail(404, "System control was not found"); }
            catch (Exception) { return Detail(503, "System control is unavailable"); }
        });
    }

    private static IResult ReadNamespace(SettingsService service, string namespaceName, string? identifier = null)
    {
        try { return Results.Ok(service.Get(namespaceName, identifier: identifier)); }
        catch (SettingsStorageException) { return Detail(503, "Settings storage is unavailable"); }
    }

    private static IResult ReadValue(SettingsService service, string namespaceName, string key, string? identifier = null)
    {
        try { return Results.Json(service.GetValue(namespaceName, key, identifier)); }
        catch (SettingNotFoundException) { return Detail(404, "Setting not found"); }
        catch (SettingsStorageException) { return Detail(503, "Settings storage is unavailable"); }
    }

    private static async Task<IResult> WriteValue(HttpRequest request, SettingsService service, string namespaceName, string key, string? identifier = null)
    {
        var value = await ReadJson(request);
        if (!value.Valid) return Detail(422, "Request body must contain valid JSON");
        try { return Results.Json(service.Set(namespaceName, key, value.Node, identifier)); }
        catch (SettingsStorageException) { return Detail(503, "Settings storage is unavailable"); }
    }

    private static IResult DeleteValue(SettingsService service, string namespaceName, string key, string? identifier = null)
    {
        try { service.Delete(namespaceName, key, identifier); return Results.NoContent(); }
        catch (SettingNotFoundException) { return Detail(404, "Setting not found"); }
        catch (SettingsStorageException) { return Detail(503, "Settings storage is unavailable"); }
    }

    private static bool IsValidScope(string namespaceName, string identifier, SettingsService service) =>
        namespaceName is "themes" or "widgets" && (namespaceName != "widgets" || service.IsValidWidget(identifier));

    private static async Task<(bool Valid, JsonNode? Node)> ReadJson(HttpRequest request)
    {
        using var reader = new StreamReader(request.Body, Encoding.UTF8);
        var body = await reader.ReadToEndAsync(request.HttpContext.RequestAborted);
        if (string.IsNullOrWhiteSpace(body)) return (false, null);
        try { return (true, JsonNode.Parse(body)); } catch (JsonException) { return (false, null); }
    }

    private static async Task<JsonObject?> ReadObject(HttpRequest request)
    {
        var value = await ReadJson(request);
        return value.Valid && value.Node is JsonObject objectValue ? objectValue : null;
    }

    private static IResult ThemeFile(string themeId, string relativePath, IThemeStorage storage)
    {
        try { return FileResult(storage.ContentPath(themeId, relativePath)); }
        catch { return Detail(404, "Theme asset was not found"); }
    }

    private static IResult FileResult(string path) => Results.File(path, ContentTypes.TryGetContentType(path, out var contentType) ? contentType : "application/octet-stream");
    internal static IResult Detail(int status, string message) => Results.Json(new Dictionary<string, string> { ["detail"] = message }, statusCode: status);

    public static async Task WriteDetail(HttpContext context, int status, string message)
    {
        if (context.Response.HasStarted) return;
        context.Response.Clear();
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new Dictionary<string, string> { ["detail"] = message });
    }

    private static async Task StreamEvents(HttpContext context, ISystemMetricsProvider provider, IMetricsSubscriptionManager manager)
    {
        MetricSubscription subscription;
        try
        {
            var fields = MetricFields.Parse(context.Request.Query["fields"].FirstOrDefault(), stream: true);
            var interval = MetricFields.ValidateInterval(ParseOptionalInt(context.Request.Query["interval"].FirstOrDefault()));
            subscription = await manager.SubscribeAsync(fields, interval, context.RequestAborted);
        }
        catch (MetricValidationException ex) { context.Response.StatusCode = 422; await context.Response.WriteAsJsonAsync(new { detail = ex.Message }); return; }
        catch (InvalidOperationException ex) { context.Response.StatusCode = 422; await context.Response.WriteAsJsonAsync(new { detail = ex.Message }); return; }

        context.Response.StatusCode = 200;
        context.Response.ContentType = "text/event-stream";
        context.Response.Headers.CacheControl = "no-cache";
        context.Response.Headers["Connection"] = "keep-alive";
        try
        {
            var receive = subscription.ReceiveAsync(context.RequestAborted).AsTask();
            while (!context.RequestAborted.IsCancellationRequested)
            {
                var heartbeat = Task.Delay(TimeSpan.FromSeconds(15), context.RequestAborted);
                var completed = await Task.WhenAny(receive, heartbeat);
                if (completed == heartbeat)
                {
                    await context.Response.WriteAsync(": heartbeat\n\n", context.RequestAborted);
                    await context.Response.Body.FlushAsync(context.RequestAborted);
                    continue;
                }
                var message = await receive;
                if (message is null) break;
                var type = message.GetValueOrDefault("type")?.ToString() ?? "message";
                await context.Response.WriteAsync($"event: {type}\ndata: {JsonSerializer.Serialize(message)}\n\n", context.RequestAborted);
                await context.Response.Body.FlushAsync(context.RequestAborted);
                receive = subscription.ReceiveAsync(context.RequestAborted).AsTask();
            }
        }
        catch (OperationCanceledException) { }
        catch (IOException) { }
        finally { subscription.Close(); }
    }

    private static async Task WebSocketEvents(HttpContext context, IReadOnlySet<string> allowedOrigins)
    {
        if (!context.WebSockets.IsWebSocketRequest) { context.Response.StatusCode = 400; return; }
        var origin = context.Request.Headers.Origin.FirstOrDefault();
        using var socket = await context.WebSockets.AcceptWebSocketAsync();
        if (!string.IsNullOrEmpty(origin) && !allowedOrigins.Contains(origin) && !IsSameOrigin(context, origin))
        {
            await socket.CloseAsync(WebSocketCloseStatus.PolicyViolation, "Origin is not allowed", context.RequestAborted);
            return;
        }
        var manager = context.RequestServices.GetService<IMetricsSubscriptionManager>();
        if (manager is null)
        {
            await socket.CloseAsync(WebSocketCloseStatus.InternalServerError, "System metric streaming is unavailable", context.RequestAborted);
            return;
        }
        using var shutdown = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted);
        MetricSubscription? subscription = null;
        CancellationTokenSource? senderCancellation = null;
        Task? sender = null;
        var sendGate = new SemaphoreSlim(1, 1);

        async Task Send(Dictionary<string, object?> message)
        {
            var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(message));
            await sendGate.WaitAsync(shutdown.Token);
            try { await socket.SendAsync(bytes, WebSocketMessageType.Text, true, shutdown.Token); }
            finally { sendGate.Release(); }
        }
        async Task Stop()
        {
            subscription?.Close(); subscription = null;
            senderCancellation?.Cancel();
            if (sender is not null) try { await sender; } catch (OperationCanceledException) { }
            senderCancellation?.Dispose(); senderCancellation = null; sender = null;
        }
        async Task Start(IReadOnlySet<string>? fields, int interval)
        {
            await Stop();
            subscription = await manager.SubscribeAsync(fields, interval, shutdown.Token);
            var active = subscription;
            var activeCancellation = CancellationTokenSource.CreateLinkedTokenSource(shutdown.Token);
            senderCancellation = activeCancellation;
            sender = Task.Run(async () =>
            {
                while (!activeCancellation.IsCancellationRequested)
                {
                    var message = await active.ReceiveAsync(activeCancellation.Token);
                    if (message is null) return;
                    await Send(message);
                }
            }, activeCancellation.Token);
        }

        try
        {
            while (socket.State == WebSocketState.Open && !shutdown.IsCancellationRequested)
            {
                var raw = await ReceiveMessage(socket, shutdown.Token);
                if (raw is null) break;
                JsonObject? message;
                try { message = JsonNode.Parse(raw)?.AsObject(); } catch (Exception ex) when (ex is JsonException or InvalidOperationException) { await Send(ErrorMessage("invalid_message", "Message must contain valid JSON")); continue; }
                if (!TryGetString(message, "type", out var operation)) { await Send(ErrorMessage("invalid_message", "Message must be an object with a type")); continue; }
                try
                {
                    if (operation == "subscribe")
                    {
                        var fields = ReadMessageFields(message);
                        var interval = ReadMessageInterval(message);
                        await Start(fields, interval);
                        await Send(new Dictionary<string, object?> { ["type"] = "subscribed", ["fields"] = fields?.OrderBy(field => field, StringComparer.Ordinal).ToArray(), ["interval"] = interval });
                    }
                    else if (operation == "unsubscribe")
                    {
                        if (subscription is null) { await Send(new Dictionary<string, object?> { ["type"] = "unsubscribed", ["fields"] = Array.Empty<string>() }); continue; }
                        var previousFields = subscription.Fields;
                        var remove = ReadMessageFields(message);
                        var current = previousFields is null ? MetricFields.Supported.ToHashSet(StringComparer.Ordinal) : previousFields.ToHashSet(StringComparer.Ordinal);
                        var interval = subscription.Interval;
                        await Stop();
                        if (remove is null) await Send(new Dictionary<string, object?> { ["type"] = "unsubscribed", ["fields"] = previousFields is null ? null : current.OrderBy(field => field, StringComparer.Ordinal).ToArray() });
                        else
                        {
                            current.ExceptWith(remove);
                            await Send(new Dictionary<string, object?> { ["type"] = "unsubscribed", ["fields"] = remove.OrderBy(field => field, StringComparer.Ordinal).ToArray() });
                            if (current.Count > 0) await Start(current, interval);
                        }
                    }
                    else if (operation == "ping") await Send(new Dictionary<string, object?> { ["type"] = "pong" });
                    else await Send(ErrorMessage("unsupported_operation", "Unsupported metric WebSocket operation"));
                }
                catch (MetricValidationException ex) { await Send(ErrorMessage("invalid_subscription", ex.Message)); }
                catch (InvalidOperationException ex) { await Send(ErrorMessage("invalid_subscription", ex.Message)); }
            }
        }
        catch (WebSocketException) { }
        catch (OperationCanceledException) { }
        finally
        {
            await Stop();
            sendGate.Dispose();
        }
    }

    private static bool IsSameOrigin(HttpContext context, string origin)
    {
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var originUri)) return false;
        var requestPort = context.Request.Host.Port ?? (context.Request.IsHttps ? 443 : 80);
        var originPort = originUri.IsDefaultPort ? (originUri.Scheme == "https" ? 443 : 80) : originUri.Port;
        return string.Equals(originUri.Scheme, context.Request.Scheme, StringComparison.OrdinalIgnoreCase)
            && string.Equals(originUri.Host, context.Request.Host.Host, StringComparison.OrdinalIgnoreCase)
            && originPort == requestPort;
    }

    private static async Task<string?> ReceiveMessage(WebSocket socket, CancellationToken cancellationToken)
    {
        var buffer = new byte[8192];
        using var stream = new MemoryStream();
        WebSocketReceiveResult result;
        do
        {
            result = await socket.ReceiveAsync(buffer, cancellationToken);
            if (result.MessageType == WebSocketMessageType.Close) return null;
            if (result.MessageType != WebSocketMessageType.Text || stream.Length + result.Count > 64 * 1024)
            { await socket.CloseAsync(WebSocketCloseStatus.MessageTooBig, "Message is too large", cancellationToken); return null; }
            stream.Write(buffer, 0, result.Count);
        } while (!result.EndOfMessage);
        return Encoding.UTF8.GetString(stream.ToArray());
    }

    private static IReadOnlySet<string>? ReadMessageFields(JsonObject message)
    {
        if (!message.ContainsKey("fields")) return null;
        if (message["fields"] is not JsonArray array || array.Count == 0 || array.Count > MetricFields.MaxFields || array.Any(value => value is not JsonValue || !value.AsValue().TryGetValue<string>(out _)))
            throw new MetricValidationException($"fields must be a non-empty list of up to {MetricFields.MaxFields} supported metric fields");
        var fields = array.Select(value => value!.GetValue<string>().Trim()).ToArray();
        if (fields.Any(string.IsNullOrEmpty) || fields.Length != fields.Distinct(StringComparer.Ordinal).Count()) throw new MetricValidationException("fields must contain unique, non-empty values");
        var invalid = fields.Except(MetricFields.Supported).OrderBy(field => field, StringComparer.Ordinal).FirstOrDefault();
        if (invalid is not null) throw new MetricValidationException($"Unsupported system metric field: {invalid}");
        return fields.ToHashSet(StringComparer.Ordinal);
    }

    private static int ReadMessageInterval(JsonObject message)
    {
        if (!message.ContainsKey("interval")) return MetricFields.DefaultInterval;
        if (message["interval"] is not JsonValue value || !value.TryGetValue<int>(out var interval)) throw new MetricValidationException($"interval must be an integer from {MetricFields.MinInterval} through {MetricFields.MaxInterval}");
        return MetricFields.ValidateInterval(interval);
    }

    private static Dictionary<string, object?> ErrorMessage(string code, string message) => new() { ["type"] = "error", ["code"] = code, ["message"] = message };
    private static int? ParseOptionalInt(string? value) => string.IsNullOrEmpty(value) ? null : int.TryParse(value, out var parsed) ? parsed : throw new MetricValidationException("Interval must be an integer from 1 through 3600");

    private static bool TryGetString(JsonObject? value, string key, out string result)
    {
        result = string.Empty;
        return value?[key] is JsonValue node && node.TryGetValue<string>(out result);
    }
}
