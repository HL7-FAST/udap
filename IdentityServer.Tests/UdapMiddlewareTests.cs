using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Duende.IdentityModel;
using Duende.IdentityServer.Models;
using Duende.IdentityServer.Stores;
using IdentityServer.Middleware;
using IdentityServer.Telemetry;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.Metrics.Testing;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Hosting.Internal;
using Microsoft.Extensions.Logging.Abstractions;
using Udap.Common.Certificates;
using Udap.Server.Validation;
using Xunit;

namespace IdentityServer.Tests;

public class UdapMiddlewareTests
{
    // Returns no resources at all, so any requested scope ends up disallowed regardless of
    // what the scope expander does with it.
    private sealed class EmptyResourceStore : IResourceStore
    {
        public Task<Resources> GetAllResourcesAsync(CancellationToken ct = default) => Task.FromResult(new Resources());

        public Task<IReadOnlyCollection<IdentityResource>> FindIdentityResourcesByScopeNameAsync(IEnumerable<string> scopeNames, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<IReadOnlyCollection<ApiScope>> FindApiScopesByNameAsync(IEnumerable<string> scopeNames, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<IReadOnlyCollection<ApiResource>> FindApiResourcesByScopeNameAsync(IEnumerable<string> scopeNames, CancellationToken ct = default)
            => throw new NotSupportedException();

        public Task<IReadOnlyCollection<ApiResource>> FindApiResourcesByNameAsync(IEnumerable<string> apiResourceNames, CancellationToken ct = default)
            => throw new NotSupportedException();
    }

    private sealed class PassThroughScopeExpander : IScopeExpander
    {
        public IEnumerable<string> Expand(IEnumerable<string> scopes) => scopes;
        public IEnumerable<string> WildCardExpand(ICollection<string> clientScopes, ICollection<string> apiScopes) => clientScopes;
        public IEnumerable<string> Aggregate(IEnumerable<string> scopes) => scopes;
    }

    private static string BuildSoftwareStatement()
    {
        var claims = new[]
        {
            new Claim(JwtClaimTypes.Scope, "system/Patient.read"),
            new Claim("grant_types", "client_credentials"),
        };
        var jwt = new JwtSecurityToken(issuer: "https://example.org/fhir", claims: claims,
            notBefore: DateTime.UtcNow, expires: DateTime.UtcNow.AddMinutes(5));
        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }

    [Fact]
    public async Task Invoke_ScopeNotAllowed_Returns400AndRecordsScopeRejected()
    {
        var services = new ServiceCollection();
        services.AddMetrics();
        services.AddSingleton(_ => new TrustChainValidator(NullLogger<TrustChainValidator>.Instance));
        services.AddSingleton<IHostApplicationLifetime>(new ApplicationLifetime(NullLogger<ApplicationLifetime>.Instance));
        services.AddSingleton<UdapMetrics>();
        var provider = services.BuildServiceProvider();
        var meterFactory = provider.GetRequiredService<System.Diagnostics.Metrics.IMeterFactory>();
        var metrics = provider.GetRequiredService<UdapMetrics>();
        using var collector = new MetricCollector<long>(meterFactory, UdapMetrics.MeterName, "udap.registration.attempts");

        RequestDelegate next = _ => throw new InvalidOperationException("next should not be called when scopes are rejected");
        var middleware = new UdapMiddleware(next, NullLogger<UdapMiddleware>.Instance, metrics);

        var body = JsonSerializer.Serialize(new { software_statement = BuildSoftwareStatement(), udap = "1" });
        var context = new DefaultHttpContext();
        context.Request.Path = "/connect/register";
        context.Request.Method = "POST";
        context.Request.ContentType = "application/json";
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(body));
        context.Response.Body = new MemoryStream();

        await middleware.Invoke(context, new EmptyResourceStore(), new PassThroughScopeExpander());

        Assert.Equal(StatusCodes.Status400BadRequest, context.Response.StatusCode);
        var measurement = Assert.Single(collector.GetMeasurementSnapshot());
        Assert.Equal(UdapMetrics.ScopeRejected, measurement.Tags["udap.outcome"]);
    }
}
