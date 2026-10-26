using IdentityServer.Telemetry;
using Xunit;

namespace IdentityServer.Tests;

public class RouteTemplatesTests
{
    // The shapes Duende and Udap.Server register: with and without a leading slash.
    private static readonly RouteTemplates Templates = new(new[]
    {
        "/connect/token",
        "connect/register",
        "/.well-known/openid-configuration/jwks",
    });

    [Theory]
    [InlineData("/.well-known/udap", "/.well-known/udap")]
    [InlineData("/.well-known/udap/communities", "/.well-known/udap/communities")]
    [InlineData("/.well-known/openid-configuration/jwks", "/.well-known/openid-configuration/jwks")]
    [InlineData("/connect/token", "/connect/token")]
    [InlineData("/connect/register/", "/connect/register")]
    [InlineData("/Connect/Token", "/connect/token")]
    [InlineData("/", "/")]
    [InlineData("", "/")]
    [InlineData(null, "/")]
    [InlineData("/certs/LocalCA/crl/LocalCA.crl", RouteTemplates.Certs)]
    [InlineData("/css/site.css", RouteTemplates.Static)]
    [InlineData("/favicon.ico", RouteTemplates.Static)]
    [InlineData("/nope", RouteTemplates.Unhandled)]
    [InlineData("/connect/evil", RouteTemplates.Unhandled)]
    [InlineData("/connect/userinfo", RouteTemplates.Unhandled)]
    [InlineData("/wp-admin/setup-config.php", RouteTemplates.Static)]
    public void Resolve_MapsMiddlewarePathsToBoundedRoutes(string? path, string expected)
    {
        Assert.Equal(expected, Templates.Resolve(path, hasEndpoint: false));
    }

    [Fact]
    public void Resolve_LeavesEndpointRoutedRequestsToTheFramework()
    {
        Assert.Null(Templates.Resolve("/Account/Login", hasEndpoint: true));
        Assert.Null(Templates.Resolve("/connect/token", hasEndpoint: true));
    }
}
