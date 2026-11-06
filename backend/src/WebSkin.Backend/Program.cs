using System.Text.Json;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.FileProviders;
using WebSkin.Backend.Api;
using WebSkin.Backend.Infrastructure;
using WebSkin.Backend.Metrics;
using WebSkin.Backend.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<JsonOptions>(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = null;
    options.SerializerOptions.DictionaryKeyPolicy = null;
    options.SerializerOptions.WriteIndented = false;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddSingleton<IPathResolver, PathResolver>();
builder.Services.AddSingleton<ISettingsStorage, JsonSettingsStorage>();
builder.Services.AddSingleton<SettingsService>();
builder.Services.AddSingleton<IThemeStorage, ThemeStorage>();
builder.Services.AddSingleton<IHardwareMonitor>(services => new HardwareMonitor(
    services.GetRequiredService<SettingsService>().HardwareMonitorEnabled,
    services.GetRequiredService<IClock>(),
    services.GetRequiredService<ILogger<HardwareMonitor>>()));
builder.Services.AddSingleton<SystemMetricsService>();
builder.Services.AddSingleton<ISystemMetricsProvider>(services => services.GetRequiredService<SystemMetricsService>());
builder.Services.AddSingleton<IMetricsSubscriptionManager>(services => services.GetRequiredService<SystemMetricsService>().Subscriptions);
builder.Services.AddSingleton<IProcessRunner, ProcessRunner>();
builder.Services.AddHostedService<MetricsLifetime>();

var origins = (Environment.GetEnvironmentVariable("FRONTEND_ORIGINS") ?? "http://localhost:4321,http://127.0.0.1:4321")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .ToHashSet(StringComparer.Ordinal);
builder.Services.AddCors(options => options.AddPolicy("frontend", policy => policy
    .WithOrigins(origins.ToArray())
    .AllowCredentials()
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();
app.Use(async (context, next) =>
{
    try { await next(); }
    catch (SettingsStorageException) { await Endpoints.WriteDetail(context, 503, "Settings storage is unavailable"); }
    catch (ThemeStorageException) { await Endpoints.WriteDetail(context, 503, "Theme storage is unavailable"); }
    catch (MetricValidationException ex) { await Endpoints.WriteDetail(context, 422, ex.Message); }
});
app.UseCors("frontend");
app.UseWebSockets();
var dashboardRoot = app.Services.GetRequiredService<IPathResolver>().GetThemePaths().DashboardRoot;
if (Directory.Exists(dashboardRoot))
{
    var dashboardProvider = new PhysicalFileProvider(dashboardRoot);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = dashboardProvider });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = dashboardProvider });
}
app.UseSwagger();
app.UseSwaggerUI(options => options.RoutePrefix = "docs");
app.MapWebSkinEndpoints(origins);
app.Run();

public partial class Program { }
