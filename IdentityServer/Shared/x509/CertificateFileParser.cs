using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;

namespace IdentityServer.Shared.x509;

/// <summary>Reads the client certificate out of an uploaded PKCS#12, DER, or PEM file.</summary>
public static class CertificateFileParser
{
    public static (string Serial, string Subject) Parse(byte[] bytes, string? password)
    {
        var bundle = TryPkcs12(bytes, password);
        if (bundle is not null)
        {
            try
            {
                // A generated bundle holds the leaf with its key plus the chain. Pick the leaf, never a CA.
                var leaf = bundle.Cast<X509Certificate2>().FirstOrDefault(c => c.HasPrivateKey && !IsCa(c))
                    ?? bundle.Cast<X509Certificate2>().FirstOrDefault(c => !IsCa(c))
                    ?? throw new CryptographicException("The bundle contains no client certificate.");
                return (leaf.SerialNumber, leaf.Subject);
            }
            finally
            {
                foreach (var certificate in bundle)
                {
                    certificate.Dispose();
                }
            }
        }

        using var single = LoadSingle(bytes);
        if (IsCa(single))
        {
            throw new CryptographicException("CA certificates cannot be revoked here; upload the client certificate.");
        }
        return (single.SerialNumber, single.Subject);
    }

    private static X509Certificate2Collection? TryPkcs12(byte[] bytes, string? password)
    {
        try
        {
            return X509CertificateLoader.LoadPkcs12Collection(bytes, password);
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    private static X509Certificate2 LoadSingle(byte[] bytes)
    {
        var text = Encoding.ASCII.GetString(bytes, 0, Math.Min(bytes.Length, 32));
        return text.Contains("-----BEGIN")
            ? X509Certificate2.CreateFromPem(Encoding.ASCII.GetString(bytes))
            : X509CertificateLoader.LoadCertificate(bytes);
    }

    private static bool IsCa(X509Certificate2 certificate) =>
        certificate.Extensions.OfType<X509BasicConstraintsExtension>().Any(e => e.CertificateAuthority);
}
