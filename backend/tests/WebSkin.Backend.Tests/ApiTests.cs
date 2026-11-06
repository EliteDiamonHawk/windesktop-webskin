using Microsoft.AspNetCore.Mvc.Testing;
using System.Net.Http.Json;

namespace WebSkin.Backend.Tests;

public sealed class ApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ApiTests(WebApplicationFactory<Program> factory) => _client = factory.CreateClient();

    [Fact]
    public async Task Health_and_status_keep_existing_payloads()
    {
        var health = await _client.GetFromJsonAsync<Dictionary<string, string>>("/api/health");
        var status = await _client.GetFromJsonAsync<Dictionary<string, string>>("/api/status");
        Assert.Equal("ok", health!["status"]);
        Assert.Equal("backend", health["service"]);
        Assert.Equal("Frontend and backend are connected.", status!["message"]);
    }

    [Fact]
    public async Task Invalid_metric_field_uses_detail_error_shape()
    {
        var response = await _client.GetAsync("/api/system/metrics?fields=memory.private.secret");
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();

        Assert.Equal(System.Net.HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal("Unsupported system metric field: memory.private.secret", body!["detail"]);
    }

    [Fact]
    public async Task Docs_route_remains_available()
    {
        var response = await _client.GetAsync("/docs/index.html");

        Assert.Equal(System.Net.HttpStatusCode.OK, response.StatusCode);
    }
}
