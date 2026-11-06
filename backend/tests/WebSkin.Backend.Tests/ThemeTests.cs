using WebSkin.Backend.Services;

namespace WebSkin.Backend.Tests;

public sealed class ThemeTests
{
    [Fact]
    public void Theme_create_and_asset_resolution_keep_package_boundary()
    {
        using var temp = new TemporaryDirectory();
        var storage = new ThemeStorage(new TestPaths(temp.Path));

        var theme = storage.Create("Example");

        Assert.Equal("Example", theme.Id);
        Assert.EndsWith("/", theme.EntryUrl);
        Assert.EndsWith("index.html", storage.ContentPath(theme.Id, ""), StringComparison.OrdinalIgnoreCase);
        Assert.Throws<ThemeStorageException>(() => storage.ContentPath(theme.Id, "../settings.json"));
    }

    [Fact]
    public void Theme_names_are_cleaned_and_conflicts_reported()
    {
        using var temp = new TemporaryDirectory();
        var storage = new ThemeStorage(new TestPaths(temp.Path));
        storage.Create("Example");

        var copy = storage.Create("Example");
        Assert.Equal("Example 2", copy.Name);
        Assert.Throws<ThemeNameConflictException>(() => storage.Rename(copy.Id, "Example"));
    }

    [Fact]
    public void Preview_requires_png_signature()
    {
        using var temp = new TemporaryDirectory();
        var storage = new ThemeStorage(new TestPaths(temp.Path));
        var theme = storage.Create("Preview");

        Assert.Throws<ThemeStorageException>(() => storage.SavePreview(theme.Id, "data:image/png;base64,ZmFrZQ=="));
        storage.SavePreview(theme.Id, "data:image/png;base64,iVBORw0KGgo=");
        Assert.True(File.Exists(storage.PreviewPath(theme.Id)));
    }
}
