using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using IdentityServer.Models;
using IdentityServer.Shared.x509;
using Xunit;

namespace IdentityServer.Tests;

public class CertificateToolingTests
{
    [Fact]
    public void BuildThrowawayCa_IntermediateChainsToRoot()
    {
        var ca = CertificateTooling.BuildThrowawayCa("Rogue");

        Assert.True(ca.Root.HasPrivateKey);
        Assert.True(ca.Intermediate.HasPrivateKey);
        Assert.Equal(ca.Root.SubjectName.Name, ca.Intermediate.IssuerName.Name);

        using var chain = new X509Chain();
        chain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust;
        chain.ChainPolicy.CustomTrustStore.Add(ca.Root);
        chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
        Assert.True(chain.Build(ca.Intermediate));
    }

    private static ClientCertificateOptions Options(string password = "udap-test") =>
        new(new X500DistinguishedName("CN=https://client.example.org/fhir"),
            ["https://client.example.org/fhir"],
            CrlUrl: "http://localhost:5000/certs/LocalCA/crl/LocalSubCA.crl",
            AiaCertUrl: "http://localhost:5000/certs/LocalCA/intermediates/LocalSubCA.crt",
            Password: password);

    private static (X509Certificate2 Leaf, X509Certificate2Collection Bundle) Build(ClientCertificateOptions options)
    {
        var ca = CertificateTooling.BuildThrowawayCa("Builder");
        var pfx = CertificateTooling.BuildUdapClientCertificate(ca.Intermediate, ca.Root, options);
        var bundle = X509CertificateLoader.LoadPkcs12Collection(pfx, options.Password, X509KeyStorageFlags.Exportable);
        return (bundle.First(c => c.HasPrivateKey), bundle);
    }

    [Fact]
    public void Default_IsRsa2048WithSanCdpAndFullChain()
    {
        var (leaf, bundle) = Build(Options());

        Assert.Equal(2048, leaf.GetRSAPublicKey()!.KeySize);
        Assert.Equal(3, bundle.Count);
        Assert.NotNull(leaf.Extensions["2.5.29.17"]);
        Assert.NotNull(leaf.Extensions["2.5.29.31"]);
        Assert.Contains(leaf.Extensions.OfType<X509KeyUsageExtension>(), e => e.KeyUsages == X509KeyUsageFlags.DigitalSignature);
    }

    [Fact]
    public void Ecdsa_UsesP384()
    {
        var (leaf, _) = Build(Options() with { KeyType = CertKeyType.Ecdsa });

        var key = leaf.GetECDsaPublicKey();
        Assert.NotNull(key);
        Assert.Equal(384, key.KeySize);
        Assert.True(leaf.HasPrivateKey);
    }

    [Fact]
    public void NoSan_OmitsExtension()
    {
        var (leaf, _) = Build(Options() with { IncludeSubjectAltName = false });
        Assert.Null(leaf.Extensions["2.5.29.17"]);
    }

    [Fact]
    public void NoCdp_OmitsExtension()
    {
        var (leaf, _) = Build(Options() with { CrlUrl = null });
        Assert.Null(leaf.Extensions["2.5.29.31"]);
    }

    [Fact]
    public void MissingIntermediate_BundleHasLeafAndRootOnly()
    {
        var (_, bundle) = Build(Options() with { IncludeIntermediateInBundle = false });
        Assert.Equal(2, bundle.Count);
        Assert.DoesNotContain(bundle.Cast<X509Certificate2>(), c => c.Subject.Contains("Intermediate"));
    }

    [Fact]
    public void KeyUsage_IsHonored()
    {
        var (leaf, _) = Build(Options() with { KeyUsage = X509KeyUsageFlags.KeyEncipherment });
        Assert.Contains(leaf.Extensions.OfType<X509KeyUsageExtension>(), e => e.KeyUsages == X509KeyUsageFlags.KeyEncipherment);
    }

    [Fact]
    public void Expired_HasNotAfterInThePast()
    {
        var now = DateTimeOffset.UtcNow;
        var (leaf, _) = Build(Options() with { NotBefore = now.AddYears(-2), NotAfter = now.AddDays(-1) });
        Assert.True(leaf.NotAfter < DateTime.UtcNow);
    }

    [Fact]
    public void NonCaIntermediate_Throws()
    {
        using var key = RSA.Create(2048);
        var request = new CertificateRequest(
            new X500DistinguishedName("CN=Not A CA"),
            key,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
        request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, true));
        request.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature, true));
        var now = DateTimeOffset.UtcNow;
        var selfSigned = request.CreateSelfSigned(now.AddDays(-1), now.AddYears(1));
        var notACa = X509CertificateLoader.LoadPkcs12(
            selfSigned.Export(X509ContentType.Pkcs12), null, X509KeyStorageFlags.Exportable);

        var ca = CertificateTooling.BuildThrowawayCa("NonCa");

        Assert.Throws<ArgumentException>(() => CertificateTooling.BuildUdapClientCertificate(notACa, ca.Root, Options()));
    }
}
