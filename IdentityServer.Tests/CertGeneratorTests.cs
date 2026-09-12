using System.Security.Cryptography.X509Certificates;
using IdentityServer.Models;
using IdentityServer.Revocation;
using IdentityServer.Shared.x509;
using Microsoft.Extensions.Options;
using Xunit;

namespace IdentityServer.Tests;

public class CertGeneratorTests
{
    private const string Password = "udap-test";

    // The generator loads its CA through CertUtil, which accepts base64 PKCS#12, so no files are needed.
    private static (CertGenerator Generator, RevocationStore Store, IssuingCa Ca) Build()
    {
        var ca = CertificateTooling.BuildThrowawayCa("Generator");
        var dir = Path.Combine(Path.GetTempPath(), "udap-gen-" + Guid.NewGuid().ToString("N"));
        var store = new RevocationStore(dir, new CrlWriter(ca.Root, ca.Intermediate, dir), null, null);
        var config = Options.Create(new AppConfig
        {
            RootCertFile = Convert.ToBase64String(ca.Root.Export(X509ContentType.Pkcs12, Password)),
            RootCertPassword = Password,
            IntermediateCertFile = Convert.ToBase64String(ca.Intermediate.Export(X509ContentType.Pkcs12, Password)),
            IntermediateCertPassword = Password,
            IntermediateCrlUrl = "http://localhost:5000/certs/LocalCA/crl/LocalSubCA.crl",
            IntermediateCertUrl = "http://localhost:5000/certs/LocalCA/intermediates/LocalSubCA.crt",
        });
        return (new CertGenerator(config, store), store, ca);
    }

    private static X509Certificate2 Leaf(byte[] pfx) =>
        X509CertificateLoader.LoadPkcs12Collection(pfx, Password, X509KeyStorageFlags.Exportable).First(c => c.HasPrivateKey);

    // The leaf's AIA URL points at localhost, so the intermediate must be supplied here, not fetched.
    private static bool ChainsTo(X509Certificate2 leaf, IssuingCa ca)
    {
        using var chain = new X509Chain();
        chain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust;
        chain.ChainPolicy.CustomTrustStore.Add(ca.Root);
        chain.ChainPolicy.ExtraStore.Add(ca.Intermediate);
        chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
        chain.ChainPolicy.DisableCertificateDownloads = true;
        return chain.Build(leaf);
    }

    [Fact]
    public async Task Valid_ChainsToConfiguredRoot()
    {
        var (generator, _, ca) = Build();
        var pfx = await generator.GenerateAsync(["https://client.example.org/fhir"], Password, CertScenarioCatalog.Find("valid")!, CertKeyType.Rsa, CancellationToken.None);
        var leaf = Leaf(pfx);

        Assert.Contains("CN=https://client.example.org/fhir", leaf.Subject);
        Assert.Contains("OU=UDAP Testing", leaf.Subject);
        Assert.NotNull(leaf.Extensions["2.5.29.31"]);
        Assert.True(ChainsTo(leaf, ca));
    }

    [Fact]
    public async Task UntrustedRoot_DoesNotChainToConfiguredRoot()
    {
        var (generator, _, ca) = Build();
        var pfx = await generator.GenerateAsync(["https://client.example.org/fhir"], Password, CertScenarioCatalog.Find("untrusted-root")!, CertKeyType.Rsa, CancellationToken.None);

        Assert.False(ChainsTo(Leaf(pfx), ca));
    }

    [Fact]
    public async Task Revoked_AddsSerialToStore()
    {
        var (generator, store, _) = Build();
        var pfx = await generator.GenerateAsync(["https://client.example.org/fhir"], Password, CertScenarioCatalog.Find("revoked")!, CertKeyType.Rsa, CancellationToken.None);

        Assert.True(store.IsRevoked(Leaf(pfx).SerialNumber));
    }

    [Fact]
    public async Task Ecdsa_ProducesP384Leaf()
    {
        var (generator, _, _) = Build();
        var pfx = await generator.GenerateAsync(["https://client.example.org/fhir"], Password, CertScenarioCatalog.Find("valid")!, CertKeyType.Ecdsa, CancellationToken.None);

        Assert.Equal(384, Leaf(pfx).GetECDsaPublicKey()!.KeySize);
    }

    [Fact]
    public void SplitAltNames_TrimsAndDropsBlankLines()
    {
        var names = CertGenerator.SplitAltNames("https://a.example.org/fhir\r\n\n  https://b.example.org/fhir  \n");

        Assert.Equal(["https://a.example.org/fhir", "https://b.example.org/fhir"], names);
        Assert.Empty(CertGenerator.SplitAltNames(null));
    }

    [Fact]
    public async Task GenerateAsync_IncludesEveryAltName()
    {
        var (generator, _, _) = Build();
        var pfx = await generator.GenerateAsync(["https://a.example.org/fhir", "https://b.example.org/fhir"], Password, CertScenarioCatalog.Find(CertScenarioCatalog.Valid)!, CertKeyType.Rsa, CancellationToken.None);
        using var leaf = Leaf(pfx);

        var san = leaf.Extensions.OfType<X509SubjectAlternativeNameExtension>().Single().Format(true);
        Assert.Contains("https://a.example.org/fhir", san);
        Assert.Contains("https://b.example.org/fhir", san);
    }
}
