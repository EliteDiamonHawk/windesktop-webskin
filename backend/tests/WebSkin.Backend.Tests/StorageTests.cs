using System.Text.Json.Nodes;
using WebSkin.Backend.Infrastructure;
using WebSkin.Backend.Services;

namespace WebSkin.Backend.Tests;

public sealed class StorageTests
{
    [Fact]
    public void Initializes_namespace_files_and_widget_directory()
    {
        using var temp = new TemporaryDirectory();
        var storage = new JsonSettingsStorage(new TestPaths(temp.Path));

        Assert.Equal(new[] { "app.json", "themes.json", "widgets.json" }, Directory.GetFiles(temp.SettingsPath, "*.json").Select(Path.GetFileName).OrderBy(name => name));
        Assert.True(Directory.Exists(Path.Combine(temp.SettingsPath, "widgets")));
        Assert.Equal(1, JsonNode.Parse(File.ReadAllText(Path.Combine(temp.SettingsPath, "widgets.json")))!["version"]!.GetValue<int>());
    }

    [Fact]
    public void Widget_write_uses_encoded_filename_and_atomic_document_shape()
    {
        using var temp = new TemporaryDirectory();
        var storage = new JsonSettingsStorage(new TestPaths(temp.Path));

        storage.SetValue("widgets", "updateInterval", JsonValue.Create(15), "my widget");

        var file = Path.Combine(temp.SettingsPath, "widgets", "my%20widget.json");
        Assert.True(File.Exists(file));
        Assert.Equal("my widget", JsonNode.Parse(File.ReadAllText(file))!["id"]!.GetValue<string>());
        Assert.Equal(15, storage.GetValue("widgets", "updateInterval", "my widget", out var found)!.GetValue<int>());
        Assert.True(found);
    }

    [Fact]
    public void Invalid_widget_index_pointer_is_rejected()
    {
        using var temp = new TemporaryDirectory();
        var storage = new JsonSettingsStorage(new TestPaths(temp.Path));
        File.WriteAllText(Path.Combine(temp.SettingsPath, "widgets.json"), "{\"version\":1,\"widgets\":{\"memory-plain\":{\"file\":\"../app.json\"}}}");

        Assert.Throws<SettingsStorageException>(() => storage.GetNamespace("widgets", "memory-plain"));
    }

    [Fact]
    public void Settings_service_resolves_widget_override_and_family_default()
    {
        using var temp = new TemporaryDirectory();
        var storage = new JsonSettingsStorage(new TestPaths(temp.Path));
        var service = new SettingsService(storage);
        storage.SetValue("app", "system_fast_update_interval_seconds", JsonValue.Create(7));
        storage.SetValue("widgets", "updateInterval", JsonValue.Create(15), "memory-plain");

        var result = service.ResolveSystemWidgetIntervals();
        Assert.Equal(7, result["fast"]);
        Assert.Equal(15, ((Dictionary<string, int>)result["widgets"]!)["memory-plain"]);
        Assert.Equal(30, result["standard"]);
    }
}

internal sealed class TemporaryDirectory : IDisposable
{
    public TemporaryDirectory()
    {
        Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "webskin-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path);
        SettingsPath = System.IO.Path.Combine(Path, "settings");
    }

    public string Path { get; }
    public string SettingsPath { get; }
    public void Dispose() { try { Directory.Delete(Path, true); } catch { } }
}

internal sealed class TestPaths(string root) : IPathResolver
{
    private readonly string _root = root;
    public ThemePaths GetThemePaths() => new(_root);
    public string GetSettingsPath() => System.IO.Path.Combine(_root, "settings");
    public string SafeAssetPath(string root, string relativePath)
    {
        var path = System.IO.Path.GetFullPath(System.IO.Path.Combine(root, relativePath));
        if (!PathResolver.IsUnder(path, System.IO.Path.GetFullPath(root)) || !File.Exists(path)) throw new FileNotFoundException();
        return path;
    }
}
