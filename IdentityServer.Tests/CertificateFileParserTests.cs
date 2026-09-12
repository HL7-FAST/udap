using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using IdentityServer.Shared.x509;
using Xunit;

namespace IdentityServer.Tests;

public class CertificateFileParserTests
{
    private static X509Certificate2 SelfSigned()
    {
        using var key = RSA.Create(2048);
        var request = new CertificateRequest("CN=parser-leaf", key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        return request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(1));
    }

    [Fact]
    public void Parse_Pkcs12Bundle_ReturnsLeafWithPrivateKey()
    {
        var ca = CertificateTooling.BuildThrowawayCa("Parser");
        var options = new ClientCertificateOptions(
            new X500DistinguishedName("CN=https://client.example.org/fhir"), ["https://client.example.org/fhir"], Password: "pw");
        var pfx = CertificateTooling.BuildUdapClientCertificate(ca.Intermediate, ca.Root, options);
        var expected = X509CertificateLoader.LoadPkcs12Collection(pfx, "pw").First(c => c.HasPrivateKey);

        var (serial, subject) = CertificateFileParser.Parse(pfx, "pw");

        Assert.Equal(expected.SerialNumber, serial);
        Assert.Equal(expected.Subject, subject);
    }

    [Fact]
    public void Parse_Der_ReturnsCertificate()
    {
        var cert = SelfSigned();
        var (serial, subject) = CertificateFileParser.Parse(cert.Export(X509ContentType.Cert), null);
        Assert.Equal(cert.SerialNumber, serial);
        Assert.Equal("CN=parser-leaf", subject);
    }

    [Fact]
    public void Parse_Pem_ReturnsCertificate()
    {
        var cert = SelfSigned();
        var pem = Encoding.ASCII.GetBytes(cert.ExportCertificatePem());
        var (serial, _) = CertificateFileParser.Parse(pem, null);
        Assert.Equal(cert.SerialNumber, serial);
    }

    [Fact]
    public void Parse_Garbage_Throws()
    {
        Assert.Throws<CryptographicException>(() => CertificateFileParser.Parse(Encoding.ASCII.GetBytes("not a certificate"), null));
    }

    [Fact]
    public void Parse_BundleWithOnlyCaKeyed_ReturnsUnkeyedLeaf()
    {
        // The intermediate carries the only private key in this bundle; the parser must still
        // skip it as a CA and fall back to the unkeyed leaf, never returning the CA's serial.
        var ca = CertificateTooling.BuildThrowawayCa("ParserCaOnly");
        var leaf = SelfSigned();
        var collection = new X509Certificate2Collection { ca.Intermediate, leaf };
        var bundle = collection.Export(X509ContentType.Pkcs12, "pw")!;

        var (serial, _) = CertificateFileParser.Parse(bundle, "pw");

        Assert.Equal(leaf.SerialNumber, serial);
    }

    [Fact]
    public void Parse_SingleCaCertificate_Throws()
    {
        var ca = CertificateTooling.BuildThrowawayCa("ParserRoot");
        var der = ca.Root.Export(X509ContentType.Cert);

        Assert.Throws<CryptographicException>(() => CertificateFileParser.Parse(der, null));
    }
}
