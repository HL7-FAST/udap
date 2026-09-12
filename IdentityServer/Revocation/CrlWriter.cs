using System.Numerics;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Serilog;

namespace IdentityServer.Revocation;

public sealed record RevokedEntry(string Serial, DateTimeOffset RevokedAt, X509RevocationReason Reason, string Subject);

/// <summary>
/// Writes the CRL files the /certs file server hands out. One file per issuing certificate,
/// named after its common name so the paths match the CDP URLs already baked into issued certificates.
/// </summary>
public sealed class CrlWriter(X509Certificate2 root, X509Certificate2 intermediate, string outputDirectory)
{
    public static readonly TimeSpan Validity = TimeSpan.FromDays(7);

    public string IntermediateCrlPath => PathFor(intermediate);
    public string RootCrlPath => PathFor(root);
    public string IntermediateSubject => intermediate.Subject;

    /// <summary>Intermediates are never revoked, so the root CRL is always empty.</summary>
    public void WriteAll(IReadOnlyList<RevokedEntry> revokedLeaves)
    {
        Write(intermediate, revokedLeaves);
        Write(root, []);
    }

    private void Write(X509Certificate2 issuer, IReadOnlyList<RevokedEntry> entries)
    {
        var path = PathFor(issuer);
        var builder = new CertificateRevocationListBuilder();

        foreach (var entry in entries)
        {
            builder.AddEntry(Convert.FromHexString(entry.Serial), entry.RevokedAt, entry.Reason);
        }

        var now = DateTimeOffset.UtcNow;
        var crl = builder.Build(issuer, NextCrlNumber(path), now.Add(Validity), HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1, now);

        Directory.CreateDirectory(outputDirectory);
        var tempPath = path + ".tmp";
        File.WriteAllBytes(tempPath, crl);
        File.Move(tempPath, path, overwrite: true);
    }

    // The entry list is rebuilt from the store every time. The old file is read only for its sequence number.
    private static BigInteger NextCrlNumber(string path)
    {
        if (!File.Exists(path))
        {
            return BigInteger.One;
        }

        try
        {
            CertificateRevocationListBuilder.Load(File.ReadAllBytes(path), out var current);
            return current + 1;
        }
        catch (Exception ex) when (ex is CryptographicException or IOException or UnauthorizedAccessException)
        {
            Log.Warning(ex, "Existing CRL at {Path} is unreadable, restarting the CRL number", path);
            return BigInteger.One;
        }
    }

    private string PathFor(X509Certificate2 issuer) =>
        Path.Combine(outputDirectory, issuer.GetNameInfo(X509NameType.SimpleName, false) + ".crl");
}
