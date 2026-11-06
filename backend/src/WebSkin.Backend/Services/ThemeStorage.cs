using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using WebSkin.Backend.Infrastructure;

namespace WebSkin.Backend.Services;

public class ThemeStorageException(string message, Exception? inner = null) : Exception(message, inner);
public sealed class ThemeValidationException(string message) : ThemeStorageException(message);
public sealed class ThemeNameConflictException(string message) : ThemeStorageException(message);

public sealed record ThemeResponse(
    [property: System.Text.Json.Serialization.JsonPropertyName("id")] string Id,
    [property: System.Text.Json.Serialization.JsonPropertyName("name")] string Name,
    [property: System.Text.Json.Serialization.JsonPropertyName("entry_url")] string EntryUrl,
    [property: System.Text.Json.Serialization.JsonPropertyName("preview")] string? Preview);

public interface IThemeStorage
{
    IReadOnlyList<ThemeResponse> List();
    ThemeResponse Create(string name);
    ThemeResponse Duplicate(string themeId);
    ThemeResponse Rename(string themeId, string name);
    void Delete(string themeId);
    void SavePreview(string themeId, string dataUrl);
    string PreviewPath(string themeId);
    string ContentPath(string themeId, string relativePath);
}

public sealed class ThemeStorage : IThemeStorage
{
    private static readonly string[] ThemeDirectories =
    ["animations", "assets", "assets/audio", "assets/fonts", "assets/icons", "assets/images", "assets/video", "components", "config", "hooks", "widgets"];
    private static readonly Dictionary<string, string> ThemeFiles = new(StringComparer.Ordinal)
    {
        ["index.html"] = "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <title>Theme</title>\n    <link rel=\"stylesheet\" href=\"theme.css\" />\n  </head>\n  <body></body>\n</html>\n",
        ["theme.css"] = ":root {\n  color-scheme: light;\n  font-family: system-ui, sans-serif;\n}\n\nhtml,\nbody {\n  min-height: 100%;\n  margin: 0;\n}\n",
        ["README.md"] = "# Theme\n\nPlace theme components, widgets, animations, configuration, and assets in the\nmatching folders in this directory.\n",
    };
    private readonly IPathResolver _paths;
    private readonly object _gate = new();

    public ThemeStorage(IPathResolver paths) => _paths = paths;

    public IReadOnlyList<ThemeResponse> List()
    {
        lock (_gate)
        {
            var root = _paths.GetThemePaths().ThemeRoot;
            if (!Directory.Exists(root)) return [];
            var themes = new List<ThemeResponse>();
            foreach (var directory in Directory.EnumerateDirectories(root))
            {
                var metadata = ReadMetadataOrThrow(directory);
                if (StringValue(metadata, "id") != Path.GetFileName(directory)
                    || StringValue(metadata, "name") is not string name
                    || !File.Exists(Path.Combine(directory, "index.html"))) continue;
                themes.Add(ToResponse(StringValue(metadata, "id")!, name, directory, includePreview: true));
            }
            return themes.OrderBy(theme => Fold(theme.Name), StringComparer.Ordinal).ToArray();
        }
    }

    public ThemeResponse Create(string name)
    {
        var cleanName = CleanThemeName(name);
        lock (_gate)
        {
            var root = _paths.GetThemePaths().ThemeRoot;
            Directory.CreateDirectory(root);
            var themeId = UniqueThemeName(root, cleanName);
            var destination = Path.Combine(root, themeId);
            var staging = CreateStaging(root, themeId);
            try
            {
                foreach (var directory in ThemeDirectories) Directory.CreateDirectory(Path.Combine(staging, directory));
                foreach (var file in ThemeFiles)
                {
                    var path = Path.Combine(staging, file.Key);
                    Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                    File.WriteAllText(path, file.Value, new UTF8Encoding(false));
                }
                foreach (var directory in ThemeDirectories) File.WriteAllText(Path.Combine(staging, directory, ".gitkeep"), string.Empty);
                WriteJsonAtomic(Path.Combine(staging, "metadata.json"), new JsonObject { ["id"] = themeId, ["name"] = themeId });
                Directory.Move(staging, destination);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                throw new ThemeStorageException($"Could not initialize theme: {destination}", ex);
            }
            finally { TryDeleteDirectory(staging); }
            return ToResponse(themeId, themeId, destination, includePreview: false);
        }
    }

    public ThemeResponse Duplicate(string themeId)
    {
        lock (_gate)
        {
            var root = _paths.GetThemePaths().ThemeRoot;
            var source = ExistingThemePath(root, themeId, "Theme was not found");
            var metadata = ReadMetadata(source);
            if (StringValue(metadata, "name") is not string sourceName || !File.Exists(Path.Combine(source, "index.html")))
                throw new ThemeStorageException("Theme metadata is invalid");
            var copyName = UniqueThemeName(root, CleanThemeName(sourceName + " Copy"));
            var destination = Path.Combine(root, copyName);
            var staging = CreateStaging(root, copyName);
            try
            {
                CopyDirectory(source, staging);
                var copyMetadata = metadata.DeepClone().AsObject();
                copyMetadata["id"] = copyName;
                copyMetadata["name"] = copyName;
                WriteJsonAtomic(Path.Combine(staging, "metadata.json"), copyMetadata);
                Directory.Move(staging, destination);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                throw new ThemeStorageException($"Could not duplicate theme: {themeId}", ex);
            }
            finally { TryDeleteDirectory(staging); }
            return ToResponse(copyName, copyName, destination, includePreview: true);
        }
    }

    public ThemeResponse Rename(string themeId, string name)
    {
        var cleanName = CleanThemeName(name);
        lock (_gate)
        {
            var root = _paths.GetThemePaths().ThemeRoot;
            var source = ExistingThemePath(root, themeId, "Theme was not found");
            if (Directory.EnumerateDirectories(root).Where(path => !path.Equals(source, StringComparison.OrdinalIgnoreCase))
                .Select(ReadMetadata).Any(metadata => StringValue(metadata, "name") is { } existing && Fold(existing) == Fold(cleanName)))
                throw new ThemeNameConflictException("Theme name is already in use");
            var destination = Path.Combine(root, cleanName);
            if (!source.Equals(destination, StringComparison.Ordinal) && Directory.Exists(destination))
                throw new ThemeNameConflictException("Theme name is already in use");
            var metadata = ReadMetadata(source) ?? throw new ThemeStorageException("Theme was not found");
            metadata["id"] = cleanName;
            metadata["name"] = cleanName;
            var moved = false;
            try
            {
                if (!source.Equals(destination, StringComparison.Ordinal))
                {
                    Directory.Move(source, destination);
                    moved = true;
                }
                WriteJsonAtomic(Path.Combine(destination, "metadata.json"), metadata);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                if (moved && !Directory.Exists(source) && Directory.Exists(destination))
                    try { Directory.Move(destination, source); } catch { }
                throw new ThemeStorageException($"Could not rename theme: {themeId}", ex);
            }
            return ToResponse(cleanName, cleanName, destination, includePreview: true);
        }
    }

    public void Delete(string themeId)
    {
        lock (_gate)
        {
            var path = ExistingThemePath(_paths.GetThemePaths().ThemeRoot, themeId, "Theme was not found");
            try { Directory.Delete(path, true); }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            { throw new ThemeStorageException($"Could not delete theme: {themeId}", ex); }
        }
    }

    public void SavePreview(string themeId, string dataUrl)
    {
        const string prefix = "data:image/png;base64,";
        if (!dataUrl.StartsWith(prefix, StringComparison.Ordinal)) throw new ThemeStorageException("Preview must be a PNG data URL");
        var encoded = dataUrl[prefix.Length..];
        if (encoded.Length == 0 || encoded.Any(character => !(char.IsLetterOrDigit(character) || character is '+' or '/' or '=')))
            throw new ThemeStorageException("Preview data is not valid base64");
        byte[] bytes;
        try { bytes = Convert.FromBase64String(encoded); }
        catch (FormatException ex) { throw new ThemeStorageException("Preview data is not valid base64", ex); }
        if (bytes.Length < 8 || !bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }))
            throw new ThemeStorageException("Preview data is not a PNG");

        lock (_gate)
        {
            var path = ExistingThemePath(_paths.GetThemePaths().ThemeRoot, themeId, "Theme was not found");
            var target = Path.Combine(path, "preview.png");
            try
            {
                AtomicFile.WriteBytes(target, bytes);
                var legacy = Path.Combine(path, "preview.svg");
                if (File.Exists(legacy)) File.Delete(legacy);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            { throw new ThemeStorageException($"Could not write theme preview: {target}", ex); }
        }
    }

    public string PreviewPath(string themeId)
    {
        lock (_gate)
        {
            var path = ExistingThemePath(_paths.GetThemePaths().ThemeRoot, themeId, "Theme preview was not found");
            var preview = Path.Combine(path, "preview.png");
            if (!File.Exists(preview)) throw new ThemeStorageException("Theme preview was not found");
            return preview;
        }
    }

    public string ContentPath(string themeId, string relativePath)
    {
        lock (_gate)
        {
            var root = ExistingThemePath(_paths.GetThemePaths().ThemeRoot, themeId, "Theme content was not found");
            var normalized = (relativePath ?? string.Empty).Replace('\\', '/');
            var parts = normalized.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (Path.IsPathRooted(normalized) || parts.Any(part => part is ".." or ".")) throw new ThemeStorageException("Theme content path is invalid");
            var path = Path.GetFullPath(Path.Combine(new[] { root }.Concat(parts).ToArray()));
            if (!PathResolver.IsUnder(path, Path.GetFullPath(root))) throw new ThemeStorageException("Theme content path is invalid");
            if (Directory.Exists(path)) path = Path.Combine(path, "index.html");
            if (!File.Exists(path)) throw new ThemeStorageException("Theme content was not found");
            return path;
        }
    }

    private static string CleanThemeName(string name)
    {
        var clean = Regex.Replace(name ?? string.Empty, @"\s+", " ").Trim();
        if (string.IsNullOrEmpty(clean)) throw new ThemeValidationException("Theme name cannot be empty");
        if (clean.Any(character => character < 32) || clean.Any(character => "<>:/\\|?*\"".Contains(character)) || clean.EndsWith('.') || clean.EndsWith(' ') || clean is "." or "..")
            throw new ThemeValidationException("Theme name contains invalid path characters");
        var reserved = Fold(clean.Split('.', 2)[0]);
        if (reserved is "con" or "prn" or "aux" or "nul" || (reserved.StartsWith("com") && int.TryParse(reserved[3..], out var com) && com is >= 1 and <= 9) || (reserved.StartsWith("lpt") && int.TryParse(reserved[3..], out var lpt) && lpt is >= 1 and <= 9))
            throw new ThemeValidationException("Theme name is reserved by Windows");
        return clean;
    }

    private static string UniqueThemeName(string root, string requested)
    {
        var existing = Directory.Exists(root)
            ? Directory.EnumerateDirectories(root).Select(ReadMetadata).Select(metadata => StringValue(metadata, "name")).Where(name => name is not null).Cast<string>().Select(Fold).ToHashSet(StringComparer.Ordinal)
            : new HashSet<string>(StringComparer.Ordinal);
        if (!existing.Contains(Fold(requested))) return requested;
        var match = Regex.Match(requested, @"^(.*?)(?:\s+(\d+))?$");
        var stem = match.Groups[1].Value.TrimEnd();
        var suffix = match.Groups[2].Success ? int.Parse(match.Groups[2].Value) + 1 : 2;
        var candidate = $"{stem} {suffix}";
        while (existing.Contains(Fold(candidate))) candidate = $"{stem} {++suffix}";
        return candidate;
    }

    private static string Fold(string value) => value.Normalize(NormalizationForm.FormKC).ToUpperInvariant();

    private static string ExistingThemePath(string root, string themeId, string message)
    {
        if (string.IsNullOrEmpty(themeId) || Path.GetFileName(themeId) != themeId) throw new ThemeStorageException(message);
        var path = Path.Combine(root, themeId);
        var metadata = Directory.Exists(path) ? ReadMetadata(path) : null;
        if (metadata is null
            || StringValue(metadata, "id") != themeId
            || StringValue(metadata, "name") is null
            || !File.Exists(Path.Combine(path, "index.html")))
            throw new ThemeStorageException(message);
        return path;
    }

    private static JsonObject? ReadMetadata(string directory)
    {
        var path = Path.Combine(directory, "metadata.json");
        if (!File.Exists(path)) return null;
        try { return JsonNode.Parse(File.ReadAllText(path))?.AsObject(); }
        catch (Exception) { return null; }
    }

    private static JsonObject? ReadMetadataOrThrow(string directory)
    {
        var path = Path.Combine(directory, "metadata.json");
        if (!File.Exists(path)) return null;
        try { return JsonNode.Parse(File.ReadAllText(path)) as JsonObject; }
        catch (Exception ex) { throw new ThemeStorageException($"Theme metadata is unreadable: {path}", ex); }
    }

    private static string? StringValue(JsonObject? value, string key)
    {
        return value?[key] is JsonValue node && node.TryGetValue<string>(out var result) ? result : null;
    }

    private static ThemeResponse ToResponse(string id, string name, string path, bool includePreview)
    {
        string? preview = null;
        if (includePreview)
        {
            var encodedId = PathEncoding.EncodeURIComponent(id);
            if (File.Exists(Path.Combine(path, "preview.png"))) preview = $"/api/themes/{encodedId}/preview";
            else
                foreach (var relative in new[] { "preview.png", "preview.jpeg", "preview.jpg", "preview.svg", "preview.webp", "preview.gif" })
                    if (File.Exists(Path.Combine(path, relative))) { preview = $"/themes/{encodedId}/{relative}"; break; }
                    else if (File.Exists(Path.Combine(path, "assets", "images", relative))) { preview = $"/themes/{encodedId}/assets/images/{relative}"; break; }
        }
        return new ThemeResponse(id, name, $"/themes/{PathEncoding.EncodeURIComponent(id)}/", preview);
    }

    private static string CreateStaging(string root, string id)
    {
        var path = Path.Combine(root, $".{id}.{Guid.NewGuid():N}.tmp");
        Directory.CreateDirectory(path);
        return path;
    }

    private static void CopyDirectory(string source, string destination)
    {
        Directory.CreateDirectory(destination);
        foreach (var directory in Directory.EnumerateDirectories(source, "*", SearchOption.AllDirectories))
            Directory.CreateDirectory(Path.Combine(destination, Path.GetRelativePath(source, directory)));
        foreach (var file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
        {
            var target = Path.Combine(destination, Path.GetRelativePath(source, file));
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.Copy(file, target, true);
        }
    }

    private static void WriteJsonAtomic(string path, JsonObject document)
    {
        AtomicFile.WriteUtf8(path, document.ToJsonString(new System.Text.Json.JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }) + "\n");
    }

    private static void TryDeleteDirectory(string path)
    { try { if (Directory.Exists(path)) Directory.Delete(path, true); } catch { } }
}
