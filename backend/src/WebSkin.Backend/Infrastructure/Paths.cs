using System.Runtime.InteropServices;
using System.Diagnostics;

namespace WebSkin.Backend.Infrastructure;

public sealed record ThemePaths(string Root)
{
    public string CommonRoot => Path.Combine(Root, "common");
    public string ThemeRoot => Path.Combine(Root, "themes");
}

public interface IPathResolver
{
    ThemePaths GetThemePaths();
    string GetSettingsPath();
    string SafeAssetPath(string root, string relativePath);
}

public sealed class PathResolver : IPathResolver
{
    private readonly string? _repositoryRoot;

    public PathResolver()
    {
        _repositoryRoot = FindRepositoryRoot();
    }

    public ThemePaths GetThemePaths()
    {
        var explicitRoot = Environment.GetEnvironmentVariable("WEBSKIN_THEMES_ROOT");
        if (!string.IsNullOrWhiteSpace(explicitRoot))
            return new ThemePaths(Path.GetFullPath(Environment.ExpandEnvironmentVariables(explicitRoot)));

        if (IsProduction() || _repositoryRoot is null)
            return new ThemePaths(Path.Combine(LocalAppData(), "WinDesktop WebSkin", "themes"));

        return new ThemePaths(Path.Combine(_repositoryRoot!, "localdata"));
    }

    public string GetSettingsPath()
    {
        var configured = Environment.GetEnvironmentVariable("WEBSKIN_SETTINGS_PATH");
        if (!string.IsNullOrWhiteSpace(configured))
            return Path.GetFullPath(Environment.ExpandEnvironmentVariables(configured));

        return IsProduction() || _repositoryRoot is null
            ? Path.Combine(LocalAppData(), "WinDesktopWebskin", "settings")
            : Path.Combine(_repositoryRoot!, "localdata", "settings");
    }

    public string SafeAssetPath(string root, string relativePath)
    {
        var normalized = (relativePath ?? string.Empty).Replace('\\', '/');
        var relative = normalized.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (Path.IsPathRooted(normalized) || relative.Any(part => part is ".." or "."))
            throw new InvalidDataException("Asset path is invalid");

        var fullRoot = Path.GetFullPath(root);
        var candidate = Path.GetFullPath(Path.Combine(new[] { fullRoot }.Concat(relative).ToArray()));
        if (!IsUnder(candidate, fullRoot) || !File.Exists(candidate))
            throw new FileNotFoundException(candidate);
        return candidate;
    }

    public static bool IsUnder(string candidate, string root)
    {
        var comparison = OperatingSystem.IsWindows()
            ? StringComparison.OrdinalIgnoreCase
            : StringComparison.Ordinal;
        var prefix = root.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
        return candidate.Equals(root, comparison) || candidate.StartsWith(prefix, comparison);
    }

    private static bool IsProduction()
    {
        var environment = Environment.GetEnvironmentVariable("WEBSKIN_ENV")?.ToLowerInvariant() ?? "development";
        var flag = Environment.GetEnvironmentVariable("WEBSKIN_PRODUCTION")?.ToLowerInvariant() ?? string.Empty;
        return environment is "production" or "prod" or "release" || flag is "1" or "true" or "yes";
    }

    private static string LocalAppData()
    {
        var configured = Environment.GetEnvironmentVariable("LOCALAPPDATA");
        if (!string.IsNullOrWhiteSpace(configured))
            return configured;
        var value = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        return string.IsNullOrWhiteSpace(value)
            ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "AppData", "Local")
            : value;
    }

    private static string? FindRepositoryRoot()
    {
        var candidates = new[]
        {
            Directory.GetCurrentDirectory(),
            AppContext.BaseDirectory,
        };

        foreach (var candidate in candidates)
        {
            var directory = new DirectoryInfo(candidate);
            while (directory is not null)
            {
                if (Directory.Exists(Path.Combine(directory.FullName, "backend"))
                    && Directory.Exists(Path.Combine(directory.FullName, "localdata")))
                    return directory.FullName;
                directory = directory.Parent;
            }
        }

        return null;
    }
}

public interface IClock
{
    DateTimeOffset UtcNow { get; }
    double MonotonicSeconds { get; }
}

public sealed class SystemClock : IClock
{
    private readonly long _started = Stopwatch.GetTimestamp();

    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
    public double MonotonicSeconds => (Stopwatch.GetTimestamp() - _started) / (double)Stopwatch.Frequency;
}
