using IdentityServer.Models;
using IdentityServer.Sandbox;
using Xunit;

namespace IdentityServer.Tests;

public class SandboxHostServiceTests
{
    [Theory]
    [InlineData("https://localhost:5001", "https://localhost:5001/sandbox")]
    [InlineData("https://udap-security.fast.hl7.org/", "https://udap-security.fast.hl7.org/sandbox")]
    [InlineData("https://example.org/udap", "https://example.org/udap/sandbox")]
    public void BuildEnvironment_DerivesSandboxUrlsFromIdpBaseUrl(string baseUrl, string expectedAppUrl)
    {
        var config = new AppConfig { UdapIdpBaseUrl = baseUrl, SandboxFhirServerUrl = "https://fhir.example.org/fhir" };

        var env = SandboxHostService.BuildEnvironment(config, "cert", "pw", "secret", trustAnyServerCertificate: false);

        Assert.Equal(expectedAppUrl, env["APP_URL"]);
        Assert.Equal(expectedAppUrl + "/api/auth", env["AUTH_URL"]);
        Assert.Equal("127.0.0.1", env["HOSTNAME"]);
        Assert.Equal("3000", env["PORT"]);
        Assert.Equal("https://fhir.example.org/fhir", env["FHIR_SERVER_URL"]);
        Assert.DoesNotContain("NODE_TLS_REJECT_UNAUTHORIZED", env.Keys);
        Assert.Equal([expectedAppUrl + "/#SAN1", expectedAppUrl + "/#SAN2"], SandboxHostService.ClientAltNames(expectedAppUrl));
    }

    [Theory]
    [InlineData(null, "/sandbox")]
    [InlineData("", "/sandbox")]
    [InlineData("/udap", "/udap/sandbox")]
    [InlineData("/udap/", "/udap/sandbox")]
    public void ExpectedBasePath_IncludesThePathBase(string? pathBase, string expected)
    {
        Assert.Equal(expected, SandboxHostService.ExpectedBasePath(new AppConfig { PathBase = pathBase }));
    }

    [Fact]
    public void BuiltBasePath_ReadsTheNextBuildManifest()
    {
        var dir = Path.Combine(Path.GetTempPath(), "udap-sandbox-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path.Combine(dir, ".next"));
        File.WriteAllText(Path.Combine(dir, ".next", "required-server-files.json"), """{"config":{"basePath":"/udap/sandbox"}}""");
        Assert.Equal("/udap/sandbox", SandboxHostService.BuiltBasePath(dir));
        Assert.Null(SandboxHostService.BuiltBasePath(Path.Combine(dir, "missing")));
    }

    [Fact]
    public void BuildEnvironment_OmitsFhirServerWhenNotConfigured()
    {
        var env = SandboxHostService.BuildEnvironment(new AppConfig { UdapIdpBaseUrl = "https://localhost:5001" }, "cert", "pw", "secret", trustAnyServerCertificate: false);
        Assert.DoesNotContain("FHIR_SERVER_URL", env.Keys);
    }

    [Fact]
    public void BuildEnvironment_DisablesTlsVerificationOnlyWhenAsked()
    {
        var config = new AppConfig { UdapIdpBaseUrl = "https://localhost:5001" };
        Assert.Equal("0", SandboxHostService.BuildEnvironment(config, "cert", "pw", "secret", trustAnyServerCertificate: true)["NODE_TLS_REJECT_UNAUTHORIZED"]);
        Assert.DoesNotContain("NODE_TLS_REJECT_UNAUTHORIZED", SandboxHostService.BuildEnvironment(config, "cert", "pw", "secret", trustAnyServerCertificate: false).Keys);
    }
}
