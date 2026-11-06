using System.Diagnostics;
using WebSkin.Backend.Metrics;

namespace WebSkin.Backend.Services;

public interface IProcessRunner
{
    void Execute(string control, ILogger logger);
}

public sealed class ProcessRunner : IProcessRunner
{
    private static readonly IReadOnlyDictionary<string, (string FileName, string Arguments, string Display)> Commands = new Dictionary<string, (string, string, string)>(StringComparer.Ordinal)
    {
        ["sleep"] = ("rundll32.exe", "powrprof.dll,SetSuspendState 0,1,0", "rundll32.exe powrprof.dll,SetSuspendState 0,1,0"),
        ["shutdown"] = ("shutdown.exe", "/s /t 0", "shutdown.exe /s /t 0"),
        ["lock"] = ("rundll32.exe", "user32.dll,LockWorkStation", "rundll32.exe user32.dll,LockWorkStation"),
        ["logout"] = ("shutdown.exe", "/l", "shutdown.exe /l"),
        ["restart"] = ("shutdown.exe", "/r /t 0", "shutdown.exe /r /t 0"),
    };

    public void Execute(string control, ILogger logger)
    {
        if (!Commands.TryGetValue(control, out var command)) throw new KeyNotFoundException(control);
        if (IsDevelopment())
        {
            Console.WriteLine($"[development] System control requested: {control} ({command.Display})");
            return;
        }
        if (!OperatingSystem.IsWindows()) throw new InvalidOperationException("Windows system control is unavailable");
        using var process = Process.Start(new ProcessStartInfo { FileName = command.FileName, Arguments = command.Arguments, UseShellExecute = false, CreateNoWindow = true });
        if (process is null) throw new InvalidOperationException("System control process could not start");
        process.WaitForExit();
        if (process.ExitCode != 0) throw new InvalidOperationException($"Windows system control {control} failed with code {process.ExitCode}");
    }

    private static bool IsDevelopment()
    {
        var environment = Environment.GetEnvironmentVariable("WEBSKIN_ENV")?.ToLowerInvariant() ?? "development";
        var flag = Environment.GetEnvironmentVariable("WEBSKIN_PRODUCTION")?.ToLowerInvariant() ?? string.Empty;
        return !(environment is "production" or "prod" or "release" || flag is "1" or "true" or "yes");
    }
}

public sealed class MetricsLifetime(SystemMetricsService service) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    public Task StopAsync(CancellationToken cancellationToken) { service.Dispose(); return Task.CompletedTask; }
}
