using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text;

namespace WebSkin.Backend.Infrastructure;

public sealed class SettingsStorageException(string message, Exception? inner = null) : Exception(message, inner);

public interface ISettingsStorage
{
    JsonObject GetNamespace(string namespaceName, string? identifier = null);
    JsonNode? GetValue(string namespaceName, string key, string? identifier, out bool found);
    void SetValue(string namespaceName, string key, JsonNode? value, string? identifier = null);
    bool DeleteValue(string namespaceName, string key, string? identifier = null);
}

public sealed class JsonSettingsStorage : ISettingsStorage
{
    private const int Version = 1;
    private static readonly string[] Namespaces = ["app", "themes", "widgets"];
    private static readonly JsonSerializerOptions WriteOptions = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };
    private readonly object _gate = new();
    private readonly string _path;
    private readonly string _widgetsPath;

    public JsonSettingsStorage(IPathResolver paths)
    {
        _path = paths.GetSettingsPath();
        _widgetsPath = Path.Combine(_path, "widgets");
        Initialize();
    }

    public JsonObject GetNamespace(string namespaceName, string? identifier = null)
    {
        lock (_gate)
        {
            var document = LoadNamespace(namespaceName);
            var values = document[namespaceName]?.AsObject() ?? throw InvalidNamespace(namespaceName);
            if (namespaceName != "widgets")
            {
                if (identifier is null) return Clone(values);
                return values[identifier]?.AsObject() is { } scoped ? Clone(scoped) : new JsonObject();
            }

            if (identifier is not null)
                return LoadWidgetSettings(identifier, values);

            var result = new JsonObject();
            foreach (var widget in values)
                result[widget.Key] = LoadWidgetSettings(widget.Key, values);
            return result;
        }
    }

    public JsonNode? GetValue(string namespaceName, string key, string? identifier, out bool found)
    {
        lock (_gate)
        {
            var document = LoadNamespace(namespaceName);
            JsonObject container;
            if (namespaceName == "widgets" && identifier is not null)
                container = LoadWidgetSettings(identifier, document[namespaceName]!.AsObject());
            else
                container = identifier is null
                    ? document[namespaceName]!.AsObject()
                    : document[namespaceName]!.AsObject()[identifier]?.AsObject() ?? new JsonObject();
            found = container.ContainsKey(key);
            return found ? container[key]?.DeepClone() : null;
        }
    }

    public void SetValue(string namespaceName, string key, JsonNode? value, string? identifier = null)
    {
        lock (_gate)
        {
            if (namespaceName == "widgets" && identifier is not null)
            {
                SetWidgetValue(identifier, key, value);
                return;
            }

            var document = LoadNamespace(namespaceName);
            var values = document[namespaceName]!.AsObject();
            var container = identifier is null
                ? values
                : values[identifier]?.AsObject() ?? new JsonObject();
            container[key] = value?.DeepClone();
            if (identifier is not null) values[identifier] = container;
            WriteDocument(NamespacePath(namespaceName), document);
        }
    }

    public bool DeleteValue(string namespaceName, string key, string? identifier = null)
    {
        lock (_gate)
        {
            if (namespaceName == "widgets" && identifier is not null)
                return DeleteWidgetValue(identifier, key);

            var document = LoadNamespace(namespaceName);
            var values = document[namespaceName]!.AsObject();
            var container = identifier is null
                ? values
                : values[identifier]?.AsObject();
            if (container is null || !container.Remove(key)) return false;
            if (identifier is not null && container.Count == 0) values.Remove(identifier);
            WriteDocument(NamespacePath(namespaceName), document);
            return true;
        }
    }

    private void Initialize()
    {
        try
        {
            Directory.CreateDirectory(_widgetsPath);
            foreach (var namespaceName in Namespaces)
            {
                var path = NamespacePath(namespaceName);
                if (!File.Exists(path))
                    WriteDocument(path, new JsonObject { ["version"] = Version, [namespaceName] = new JsonObject() });
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            throw new SettingsStorageException($"Could not initialize settings directory: {_path}", ex);
        }
    }

    private JsonObject LoadNamespace(string namespaceName)
    {
        var path = NamespacePath(namespaceName);
        try
        {
            var document = JsonNode.Parse(File.ReadAllText(path))?.AsObject()
                ?? throw InvalidNamespace(namespaceName);
            if (document["version"]?.GetValue<int>() != Version || document[namespaceName] is not JsonObject values)
                throw InvalidNamespace(namespaceName);
            if (namespaceName == "themes" && values.Any(entry => entry.Value is not JsonObject))
                throw new SettingsStorageException("Settings namespace contains invalid entries: themes");
            if (namespaceName == "widgets") ValidateWidgetIndex(values);
            return document;
        }
        catch (SettingsStorageException) { throw; }
        catch (Exception ex) when (ex is IOException or JsonException or InvalidOperationException or FormatException)
        {
            throw new SettingsStorageException($"Settings file is unreadable: {path}", ex);
        }
    }

    private void SetWidgetValue(string identifier, string key, JsonNode? value)
    {
        ValidateWidgetIdentifier(identifier);
        var document = LoadNamespace("widgets");
        var index = document["widgets"]!.AsObject();
        if (index[identifier] is null)
        {
            var widgetPath = GeneratedWidgetPath(identifier);
            WriteWidgetFile(widgetPath, identifier, new JsonObject { [key] = value?.DeepClone() });
            index[identifier] = new JsonObject { ["file"] = RelativeWidgetPath(widgetPath) };
            WriteDocument(NamespacePath("widgets"), document);
            return;
        }

        var settings = LoadWidgetSettings(identifier, index);
        settings[key] = value?.DeepClone();
        WriteWidgetFile(IndexedWidgetPath(identifier, index[identifier]!.AsObject()), identifier, settings);
    }

    private bool DeleteWidgetValue(string identifier, string key)
    {
        ValidateWidgetIdentifier(identifier);
        var document = LoadNamespace("widgets");
        var index = document["widgets"]!.AsObject();
        if (index[identifier] is null) return false;
        var settings = LoadWidgetSettings(identifier, index);
        if (!settings.Remove(key)) return false;
        WriteWidgetFile(IndexedWidgetPath(identifier, index[identifier]!.AsObject()), identifier, settings);
        return true;
    }

    private JsonObject LoadWidgetSettings(string identifier, JsonObject index)
    {
        ValidateWidgetIdentifier(identifier);
        if (index[identifier] is null) return new JsonObject();
        var path = IndexedWidgetPath(identifier, index[identifier]!.AsObject());
        try
        {
            var document = JsonNode.Parse(File.ReadAllText(path))?.AsObject();
            if (document?["version"]?.GetValue<int>() != Version
                || document["id"]?.GetValue<string>() != identifier
                || document["settings"] is not JsonObject settings)
                throw new SettingsStorageException($"Widget settings file has an invalid format: {path}");
            return Clone(settings);
        }
        catch (SettingsStorageException) { throw; }
        catch (Exception ex) when (ex is IOException or JsonException or InvalidOperationException or FormatException)
        {
            throw new SettingsStorageException($"Widget settings file is unreadable: {path}", ex);
        }
    }

    private void ValidateWidgetIndex(JsonObject index)
    {
        foreach (var entry in index)
        {
            ValidateWidgetIdentifier(entry.Key);
            if (entry.Value is not JsonObject value || value["file"]?.GetValue<string>() is not string)
                throw new SettingsStorageException($"Widget index entry is invalid: {entry.Key}");
            _ = IndexedWidgetPath(entry.Key, value);
        }
    }

    private string IndexedWidgetPath(string identifier, JsonObject entry)
    {
        ValidateWidgetIdentifier(identifier);
        var relative = entry["file"]?.GetValue<string>() ?? string.Empty;
        var parts = relative.Replace('\\', '/').Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2 || parts[0] != "widgets" || !parts[1].EndsWith(".json", StringComparison.OrdinalIgnoreCase))
            throw new SettingsStorageException($"Widget settings path is invalid: {identifier}");
        var candidate = Path.GetFullPath(Path.Combine(new[] { _path }.Concat(parts).ToArray()));
        if (!PathResolver.IsUnder(candidate, Path.GetFullPath(_widgetsPath)) || !File.Exists(candidate))
            throw new SettingsStorageException($"Widget settings file is missing: {candidate}");
        return candidate;
    }

    private string GeneratedWidgetPath(string identifier) => Path.Combine(_widgetsPath, PathEncoding.PythonQuote(identifier) + ".json");
    private string RelativeWidgetPath(string path) => Path.GetRelativePath(_path, path).Replace(Path.DirectorySeparatorChar, '/');
    private string NamespacePath(string namespaceName)
    {
        if (!Namespaces.Contains(namespaceName, StringComparer.Ordinal))
            throw new SettingsStorageException($"Settings namespace is invalid: {namespaceName}");
        return Path.Combine(_path, namespaceName + ".json");
    }

    private void WriteWidgetFile(string path, string identifier, JsonObject settings) =>
        WriteDocument(path, new JsonObject { ["version"] = Version, ["id"] = identifier, ["settings"] = settings });

    private static void ValidateWidgetIdentifier(string identifier)
    {
        if (string.IsNullOrEmpty(identifier) || identifier is "." or ".." || identifier.Contains('/') || identifier.Contains('\\') || identifier.Contains('\0'))
            throw new SettingsStorageException("Widget identifier is invalid");
    }

    private static JsonObject Clone(JsonObject value) => value.DeepClone().AsObject();
    private static SettingsStorageException InvalidNamespace(string namespaceName) =>
        new($"Settings file has an unsupported format or version: {namespaceName}");

    private static void WriteDocument(string path, JsonNode document)
    {
        try
        {
            AtomicFile.WriteUtf8(path, document.ToJsonString(WriteOptions) + "\n");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            throw new SettingsStorageException($"Could not write settings file: {path}", ex);
        }
    }
}
