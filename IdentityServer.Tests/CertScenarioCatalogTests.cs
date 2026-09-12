using System.Security.Cryptography.X509Certificates;
using IdentityServer.Controllers;
using IdentityServer.Models;
using IdentityServer.Shared.x509;
using IdentityServer.Telemetry;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Hosting.Internal;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Udap.Common.Certificates;
using Xunit;

namespace IdentityServer.Tests;

public class CertScenarioCatalogTests
{
    private static ClientCertificateOptions BaseOptions() =>
        new(new X500DistinguishedName("CN=https://client.example.org/fhir"),
            ["https://client.example.org/fhir"],
            CrlUrl: "http://localhost:5000/certs/LocalCA/crl/LocalSubCA.crl",
            AiaCertUrl: "http://localhost:5000/certs/LocalCA/intermediates/LocalSubCA.crt",
            NotBefore: DateTimeOffset.UtcNow.AddDays(-1),
            NotAfter: DateTimeOffset.UtcNow.AddYears(2));

    [Fact]
    public void Keys_MatchSpecAndAreUnique()
    {
        string[] expected = ["valid", "expired", "not-yet-valid", "untrusted-root", "revoked", "no-cdp", "dead-cdp",
            "missing-san", "missing-intermediate"];
        Assert.Equal(expected, CertScenarioCatalog.All.Select(s => s.Key).ToArray());
    }

    [Fact]
    public void Find_IsCaseInsensitiveAndNullForUnknown()
    {
        Assert.Equal("expired", CertScenarioCatalog.Find("EXPIRED")!.Key);
        Assert.Null(CertScenarioCatalog.Find("nope"));
    }

    [Fact]
    public void Shapes_ProduceExpectedKnobs()
    {
        var now = DateTimeOffset.UtcNow;
        Assert.True(CertScenarioCatalog.Find("expired")!.Shape(BaseOptions()).NotAfter < now);
        Assert.True(CertScenarioCatalog.Find("not-yet-valid")!.Shape(BaseOptions()).NotBefore > now);
        Assert.Null(CertScenarioCatalog.Find("no-cdp")!.Shape(BaseOptions()).CrlUrl);
        Assert.EndsWith("LocalSubCA-missing.crl", CertScenarioCatalog.Find("dead-cdp")!.Shape(BaseOptions()).CrlUrl);
        Assert.False(CertScenarioCatalog.Find("missing-san")!.Shape(BaseOptions()).IncludeSubjectAltName);
        Assert.False(CertScenarioCatalog.Find("missing-intermediate")!.Shape(BaseOptions()).IncludeIntermediateInBundle);
        Assert.True(CertScenarioCatalog.Find("untrusted-root")!.UntrustedIssuer);
        Assert.True(CertScenarioCatalog.Find("revoked")!.RevokeAfterIssue);
    }

    [Fact]
    public void EveryScenario_BuildsALoadablePfx()
    {
        var ca = CertificateTooling.BuildThrowawayCa("Catalog");
        foreach (var scenario in CertScenarioCatalog.All)
        {
            var pfx = CertificateTooling.BuildUdapClientCertificate(ca.Intermediate, ca.Root, scenario.Shape(BaseOptions()));
            var bundle = X509CertificateLoader.LoadPkcs12Collection(pfx, "udap-test", X509KeyStorageFlags.Exportable);
            Assert.Contains(bundle.Cast<X509Certificate2>(), c => c.HasPrivateKey);
        }
    }

    private static CertController Controller()
    {
        var services = new ServiceCollection();
        services.AddMetrics();
        services.AddSingleton(_ => new TrustChainValidator(NullLogger<TrustChainValidator>.Instance));
        services.AddSingleton<IHostApplicationLifetime>(new ApplicationLifetime(NullLogger<ApplicationLifetime>.Instance));
        services.AddSingleton<UdapMetrics>();
        var metrics = services.BuildServiceProvider().GetRequiredService<UdapMetrics>();

        var config = Options.Create(new AppConfig { DefaultCertPassword = "udap-test" });
        return new CertController(config, metrics);
    }

    [Fact]
    public async Task Generate_UnknownScenarioIs400()
    {
        var result = await Controller().Generate(new CertGenerateRequest { AltNames = ["https://x.example.org"], Scenario = "bogus" });
        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("untrusted-root", bad.Value!.ToString());
    }

    [Fact]
    public async Task Generate_UnknownKeyTypeIs400()
    {
        var result = await Controller().Generate(new CertGenerateRequest
        {
            AltNames = ["https://x.example.org"], KeyType = (CertKeyType)999
        });
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Generate_ScenarioWithFhirLabsIs400()
    {
        var result = await Controller().Generate(new CertGenerateRequest
        {
            AltNames = ["https://x.example.org"], Scenario = "expired", Provider = CertGenerationProvider.FhirLabs
        });
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Generate_FhirLabsWithEcdsaIs400()
    {
        var result = await Controller().Generate(new CertGenerateRequest
        {
            AltNames = ["https://x.example.org"], Provider = CertGenerationProvider.FhirLabs, KeyType = CertKeyType.Ecdsa
        });
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Generate_TooManyAltNamesIs400()
    {
        var names = Enumerable.Range(0, CertGenerator.MaxAltNames + 1).Select(i => $"https://x{i}.example.org").ToList();
        var result = await Controller().Generate(new CertGenerateRequest { AltNames = names, Password = "udap-test" });
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Generate_RelativeAltNameIs400()
    {
        var result = await Controller().Generate(new CertGenerateRequest { AltNames = ["not a uri"] });
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public void Scenarios_ReturnsSummaries()
    {
        var ok = Assert.IsType<OkObjectResult>(Controller().Scenarios());
        var summaries = Assert.IsAssignableFrom<IEnumerable<CertScenarioSummary>>(ok.Value);
        Assert.Equal(CertScenarioCatalog.All.Count, summaries.Count());
    }

    [Fact]
    public void EveryScenario_HasVerbatimReferences()
    {
        foreach (var scenario in CertScenarioCatalog.All)
        {
            Assert.NotEmpty(scenario.References);
            foreach (var reference in scenario.References)
            {
                Assert.StartsWith("https://", reference.Url);
                Assert.True(reference.Quote.Length > 40);
                Assert.False(string.IsNullOrWhiteSpace(reference.Section));
            }
        }
    }
}
