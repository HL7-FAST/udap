using System.Numerics;
using System.Security.Cryptography.X509Certificates;
using IdentityServer.Revocation;
using IdentityServer.Shared.x509;
using Xunit;

namespace IdentityServer.Tests;

public class CrlWriterTests
{
    private static string TempDir() => Path.Combine(Path.GetTempPath(), "udap-crl-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public void WriteAll_WritesBothFilesAndIncrementsCrlNumber()
    {
        var ca = CertificateTooling.BuildThrowawayCa("CrlTest");
        var writer = new CrlWriter(ca.Root, ca.Intermediate, TempDir());

        writer.WriteAll([]);
        Assert.True(File.Exists(writer.RootCrlPath));
        Assert.EndsWith("CrlTest Intermediate.crl", writer.IntermediateCrlPath);
        var first = CertificateRevocationListBuilder.Load(File.ReadAllBytes(writer.IntermediateCrlPath), out var firstNumber);
        Assert.Equal(BigInteger.One, firstNumber);

        const string serial = "0A1B2C3D";
        writer.WriteAll([new RevokedEntry(serial, DateTimeOffset.UtcNow, X509RevocationReason.KeyCompromise, "CN=leaf")]);
        var second = CertificateRevocationListBuilder.Load(File.ReadAllBytes(writer.IntermediateCrlPath), out var secondNumber);
        Assert.Equal(new BigInteger(2), secondNumber);

        // RemoveEntry reports whether the serial was present, which is the only entry lookup the builder exposes.
        Assert.True(second.RemoveEntry(Convert.FromHexString(serial)));
        Assert.False(first.RemoveEntry(Convert.FromHexString(serial)));
    }

    [Fact]
    public void WriteAll_ReplacesUnreadableExistingFile()
    {
        var ca = CertificateTooling.BuildThrowawayCa("CrlGarbage");
        var dir = TempDir();
        Directory.CreateDirectory(dir);
        var writer = new CrlWriter(ca.Root, ca.Intermediate, dir);
        File.WriteAllText(writer.IntermediateCrlPath, "not a crl");

        writer.WriteAll([]);

        CertificateRevocationListBuilder.Load(File.ReadAllBytes(writer.IntermediateCrlPath), out var number);
        Assert.Equal(BigInteger.One, number);
    }
}
