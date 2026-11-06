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
}
