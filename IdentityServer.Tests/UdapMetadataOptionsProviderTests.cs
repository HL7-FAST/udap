using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Udap.Common.Models;
using Xunit;

namespace IdentityServer.Tests;

public class UdapMetadataOptionsProviderTests
{
    private static IssuedCertificate Issued(string community, params string[] uris)
    {
        using var key = RSA.Create(2048);
        var request = new CertificateRequest("CN=test", key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        var sans = new SubjectAlternativeNameBuilder();
        foreach (var uri in uris)
        {
            sans.AddUri(new Uri(uri));
        }
        request.CertificateExtensions.Add(sans.Build());
        var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(1));
        return new IssuedCertificate(certificate, community);
    }

    [Theory]
    [InlineData("https://localhost:5001", "https://localhost:5001")]
    [InlineData("https://localhost:5001", "https://localhost:5001/")]
    [InlineData("https://localhost:5001/", "https://localhost:5001")]
    [InlineData("https://host.example.org/udap", "https://host.example.org/udap/")]
    public void CommunitiesFor_MatchesBaseUrl_IgnoringTrailingSlash(string baseUrl, string san)
    {
        var communities = UdapMetadataOptionsProvider.CommunitiesFor(baseUrl, [Issued("udap://A", san)]);

        Assert.Equal(["udap://A"], communities);
    }

    [Theory]
    [InlineData("https://localhost:5011")]
    [InlineData("http://localhost:5001")]
    [InlineData("https://localhost:5001/udap")]
    public void CommunitiesFor_OtherBaseUrl_ReturnsNothing(string baseUrl)
    {
        var communities = UdapMetadataOptionsProvider.CommunitiesFor(baseUrl, [Issued("udap://A", "https://localhost:5001")]);

        Assert.Empty(communities);
    }

    [Fact]
    public void CommunitiesFor_KeepsStoreOrder_AndSkipsOtherHosts()
    {
        var certificates = new[]
        {
            Issued("udap://Other", "https://other.example.org"),
            Issued("udap://B", "https://host.example.org"),
            Issued("udap://A", "https://unrelated.example.org", "https://host.example.org/"),
            Issued("udap://B", "https://host.example.org")
        };

        var communities = UdapMetadataOptionsProvider.CommunitiesFor("https://host.example.org", certificates);

        Assert.Equal(["udap://B", "udap://A"], communities);
    }
}
