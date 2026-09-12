
//
// Adapted from https://github.com/JoeShook/UdapEd/blob/main/Shared/Services/x509/CertificateTooling.cs
//

using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using IdentityServer.Models;

namespace IdentityServer.Shared.x509;

public sealed record ClientCertificateOptions(
    X500DistinguishedName DistinguishedName,
    List<string> SubjectAltNames,
    string? CrlUrl = null,
    string? AiaCertUrl = null,
    DateTimeOffset NotBefore = default,
    DateTimeOffset NotAfter = default,
    string Password = "udap-test",
    CertKeyType KeyType = CertKeyType.Rsa,
    X509KeyUsageFlags KeyUsage = X509KeyUsageFlags.DigitalSignature,
    bool IncludeSubjectAltName = true,
    bool IncludeIntermediateInBundle = true);

public sealed record IssuingCa(X509Certificate2 Root, X509Certificate2 Intermediate);

public static class CertificateTooling
{
    public static byte[] BuildUdapClientCertificate(
            X509Certificate2 intermediateCert,
            X509Certificate2 caCert,
            ClientCertificateOptions options)
    {
        var intermediateKey = intermediateCert.GetRSAPrivateKey()
            ?? throw new ArgumentException("Intermediate certificate must include its RSA private key.", nameof(intermediateCert));

        // The signature-generator overload skips the issuer checks Create(X509Certificate2) performs,
        // so guard against a misconfigured intermediate that is not a CA.
        var basicConstraints = intermediateCert.Extensions.OfType<X509BasicConstraintsExtension>().FirstOrDefault();
        var keyUsage = intermediateCert.Extensions.OfType<X509KeyUsageExtension>().FirstOrDefault();
        if (basicConstraints is { CertificateAuthority: false } || keyUsage is not null && !keyUsage.KeyUsages.HasFlag(X509KeyUsageFlags.KeyCertSign))
        {
            throw new ArgumentException("Intermediate certificate is not a CA allowed to sign certificates.", nameof(intermediateCert));
        }

        using AsymmetricAlgorithm leafKey = options.KeyType == CertKeyType.Ecdsa
            ? ECDsa.Create(ECCurve.NamedCurves.nistP384)
            : RSA.Create(2048);

        var clientCertRequest = leafKey is ECDsa ecdsaKey
            ? new CertificateRequest(options.DistinguishedName, ecdsaKey, HashAlgorithmName.SHA256)
            : new CertificateRequest(options.DistinguishedName, (RSA)leafKey, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

        clientCertRequest.CertificateExtensions.Add(
            new X509BasicConstraintsExtension(false, false, 0, true));

        clientCertRequest.CertificateExtensions.Add(
            new X509KeyUsageExtension(options.KeyUsage, true));

        clientCertRequest.CertificateExtensions.Add(
            new X509SubjectKeyIdentifierExtension(clientCertRequest.PublicKey, false));

        AddAuthorityKeyIdentifier(intermediateCert, clientCertRequest);

        if (options.CrlUrl != null)
        {
            clientCertRequest.CertificateExtensions.Add(MakeCdp(options.CrlUrl));
        }

        if (options.IncludeSubjectAltName)
        {
            var subAltNameBuilder = new SubjectAlternativeNameBuilder();
            foreach (var subjectAltName in options.SubjectAltNames)
            {
                subAltNameBuilder.AddUri(new Uri(subjectAltName)); //Same as iss claim
            }

            clientCertRequest.CertificateExtensions.Add(subAltNameBuilder.Build());
        }

        if (options.AiaCertUrl != null)
        {
            var authorityInfoAccessBuilder = new AuthorityInformationAccessBuilder();
            authorityInfoAccessBuilder.AddCertificateAuthorityIssuerUri(new Uri(options.AiaCertUrl));
            clientCertRequest.CertificateExtensions.Add(authorityInfoAccessBuilder.Build());
        }

        var notBefore = options.NotBefore == default ? DateTimeOffset.UtcNow : options.NotBefore;
        var notAfter = options.NotAfter == default ? DateTimeOffset.UtcNow.AddYears(2) : options.NotAfter;

        // The signature generator path signs RSA and ECDSA leaf keys alike under the RSA intermediate.
        var clientCert = clientCertRequest.Create(
            intermediateCert.SubjectName,
            X509SignatureGenerator.CreateForRSA(intermediateKey, RSASignaturePadding.Pkcs1),
            notBefore,
            notAfter,
            new ReadOnlySpan<byte>(RandomNumberGenerator.GetBytes(16)));
        // Do something with these certs, like export them to PFX,
        // or add them to an X509Store, or whatever.
        var clientCertWithKey = leafKey is ECDsa ecdsaPrivate
            ? clientCert.CopyWithPrivateKey(ecdsaPrivate)
            : clientCert.CopyWithPrivateKey((RSA)leafKey);

        var certPackage = new X509Certificate2Collection { clientCertWithKey };
        if (options.IncludeIntermediateInBundle)
        {
            certPackage.Add(X509CertificateLoader.LoadCertificate(intermediateCert.Export(X509ContentType.Cert)));
        }
        certPackage.Add(X509CertificateLoader.LoadCertificate(caCert.Export(X509ContentType.Cert)));

        return certPackage.Export(X509ContentType.Pkcs12, options.Password)!;
    }

    /// <summary>
    /// Mints a root and intermediate that no community trusts. Used for the untrusted-root
    /// scenario and by tests. Never written to CertStore, because SeedData trusts every
    /// CertStore subdirectory as a community.
    /// </summary>
    public static IssuingCa BuildThrowawayCa(string name)
    {
        var caKeyUsage = X509KeyUsageFlags.KeyCertSign | X509KeyUsageFlags.CrlSign | X509KeyUsageFlags.DigitalSignature;
        var now = DateTimeOffset.UtcNow;

        using var rootKey = RSA.Create(2048);
        var rootRequest = new CertificateRequest(
            new X500DistinguishedName($"CN={name} Root, O=Untrusted"),
            rootKey,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
        rootRequest.CertificateExtensions.Add(new X509BasicConstraintsExtension(true, false, 0, true));
        rootRequest.CertificateExtensions.Add(new X509KeyUsageExtension(caKeyUsage, true));
        rootRequest.CertificateExtensions.Add(new X509SubjectKeyIdentifierExtension(rootRequest.PublicKey, false));
        var root = WithPortableKey(rootRequest.CreateSelfSigned(now.AddDays(-1), now.AddYears(10)));

        using var intermediateKey = RSA.Create(2048);
        var intermediateRequest = new CertificateRequest(
            new X500DistinguishedName($"CN={name} Intermediate, O=Untrusted"),
            intermediateKey,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1);
        intermediateRequest.CertificateExtensions.Add(new X509BasicConstraintsExtension(true, true, 0, true));
        intermediateRequest.CertificateExtensions.Add(new X509KeyUsageExtension(caKeyUsage, true));
        intermediateRequest.CertificateExtensions.Add(new X509SubjectKeyIdentifierExtension(intermediateRequest.PublicKey, false));
        AddAuthorityKeyIdentifier(root, intermediateRequest);
        var intermediate = intermediateRequest
            .Create(root, now.AddDays(-1), now.AddYears(5), RandomNumberGenerator.GetBytes(16))
            .CopyWithPrivateKey(intermediateKey);

        return new IssuingCa(root, WithPortableKey(intermediate));
    }

    // Round-tripping through PKCS#12 detaches the certificate from the key object that
    // created it, so disposing that key does not invalidate the certificate.
    private static X509Certificate2 WithPortableKey(X509Certificate2 certificate) =>
        X509CertificateLoader.LoadPkcs12(certificate.Export(X509ContentType.Pkcs12), null, X509KeyStorageFlags.Exportable);

    private static void AddAuthorityKeyIdentifier(X509Certificate2 caCert, CertificateRequest intermediateReq)
    {
        //
        // Found way to generate intermediate below
        //
        // https://github.com/rwatjen/AzureIoTDPSCertificates/blob/711429e1b6dee7857452233a73f15c22c2519a12/src/DPSCertificateTool/CertificateUtil.cs#L69
        // https://blog.rassie.dk/2018/04/creating-an-x-509-certificate-chain-in-c/
        //


        var issuerSubjectKey = caCert.Extensions["2.5.29.14"]?.RawData
            ?? throw new ArgumentException("CA certificate must include a subject key identifier extension.", nameof(caCert));
        var segment = new ArraySegment<byte>(issuerSubjectKey, 2, issuerSubjectKey.Length - 2);
        var authorityKeyIdentifier = new byte[segment.Count + 4];
        // these bytes define the "KeyID" part of the AuthorityKeyIdentifier
        authorityKeyIdentifier[0] = 0x30;
        authorityKeyIdentifier[1] = 0x16;
        authorityKeyIdentifier[2] = 0x80;
        authorityKeyIdentifier[3] = 0x14;
        segment.CopyTo(authorityKeyIdentifier, 4);
        intermediateReq.CertificateExtensions.Add(new X509Extension("2.5.29.35", authorityKeyIdentifier, false));
    }

    private static X509Extension MakeCdp(string url)
    {
        //
        // urls less than 119 char solution.
        // From Bartonjs of course.
        //
        // https://stackoverflow.com/questions/60742814/add-crl-distribution-points-cdp-extension-to-x509certificate2-certificate
        //
        // From Crypt32:  .NET doesn't support CDP extension. You have to use 3rd party libraries for that. BC is ok if it works for you.
        // Otherwise write you own. :)
        //

        byte[] encodedUrl = Encoding.ASCII.GetBytes(url);

        if (encodedUrl.Length > 119)
        {
            throw new NotSupportedException();
        }

        byte[] payload = new byte[encodedUrl.Length + 10];
        int offset = 0;
        payload[offset++] = 0x30;
        payload[offset++] = (byte)(encodedUrl.Length + 8);
        payload[offset++] = 0x30;
        payload[offset++] = (byte)(encodedUrl.Length + 6);
        payload[offset++] = 0xA0;
        payload[offset++] = (byte)(encodedUrl.Length + 4);
        payload[offset++] = 0xA0;
        payload[offset++] = (byte)(encodedUrl.Length + 2);
        payload[offset++] = 0x86;
        payload[offset++] = (byte)(encodedUrl.Length);
        Buffer.BlockCopy(encodedUrl, 0, payload, offset, encodedUrl.Length);

        return new X509Extension("2.5.29.31", payload, critical: false);
    }
}