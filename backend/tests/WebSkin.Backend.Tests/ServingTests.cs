using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using WebSkin.Backend.Infrastructure;

namespace WebSkin.Backend.Tests;

public sealed class ServingTests : IDisposable
{
    private readonly TemporaryDirectory _temp = new();
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public ServingTests()
    {
        var dashboardRoot = Path.Combine(_temp.Path, "dashboard");
        Directory.CreateDirectory(dashboardRoot);
        File.WriteAllText(Path.Combine(dashboardRoot, "index.html"), "dashboard root");
        Directory.CreateDirectory(Path.Combine(dashboardRoot, "dashboard"));
        File.WriteAllText(Path.Combine(dashboardRoot, "dashboard", "index.html"), "dashboard page");

        var themeRoot = Path.Combine(_temp.Path, "themes", "Example");
        Directory.CreateDirectory(themeRoot);
        File.WriteAllText(Path.Combine(themeRoot, "metadata.json"), "{\"id\":\"Example\",\"name\":\"Example\"}");
        File.WriteAllText(Path.Combine(themeRoot, "index.html"), "theme page");

        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IPathResolver>();
                services.AddSingleton<IPathResolver>(new TestPaths(_temp.Path));
            });
        });
        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task Dashboard_routes_serve_static_files()
    {
        Assert.Equal("dashboard root", await _client.GetStringAsync("/"));
        Assert.Equal("dashboard page", await _client.GetStringAsync("/dashboard/"));
    }

    [Fact]
    public async Task Theme_route_serves_user_installed_theme()
    {
        Assert.Equal("theme page", await _client.GetStringAsync("/themes/Example/"));
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
        _temp.Dispose();
    }
}

public sealed class ApiWithoutDashboardTests : IDisposable
{
    private readonly TemporaryDirectory _temp = new();
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public ApiWithoutDashboardTests()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IPathResolver>();
                services.AddSingleton<IPathResolver>(new TestPaths(_temp.Path));
            });
        });
        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task Api_remains_available_without_dashboard_files()
    {
        var response = await _client.GetAsync("/api/health");

        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    }

    public void Dispose()
    {
        _client.Dispose();
        _factory.Dispose();
        _temp.Dispose();
    }
}

public sealed class RuntimeRootTests
{
    [Fact]
    public void Dashboard_root_follows_explicit_runtime_root()
    {
        using var temp = new TemporaryDirectory();
        var previousRoot = Environment.GetEnvironmentVariable("WEBSKIN_THEMES_ROOT");
        try
        {
            Environment.SetEnvironmentVariable("WEBSKIN_THEMES_ROOT", temp.Path);

            var paths = new PathResolver().GetThemePaths();

            Assert.Equal(Path.Combine(temp.Path, "dashboard"), paths.DashboardRoot);
        }
        finally
        {
            Environment.SetEnvironmentVariable("WEBSKIN_THEMES_ROOT", previousRoot);
        }
    }
}
