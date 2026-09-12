using System.Security.Cryptography.X509Certificates;
using IdentityServer.Models;
using IdentityServer.Revocation;
using Microsoft.Extensions.Options;

namespace IdentityServer.Shared.x509;

/// <summary>
/// Issues a client certificate for a scenario. Resolve it only where a certificate is
/// actually generated, because constructing RevocationStore loads the local CA files.
/// </summary>
public sealed class CertGenerator(IOptions<AppConfig> appConfig, RevocationStore revocationStore)
{
    private readonly AppConfig _config = appConfig.Value;

    public const string RateLimitPolicy = "cert-generation";

    public const int MaxAltNameLength = 200;

    public const int MaxAltNames = 10;

    /// <summary>Splits a form field with one SAN per line. Blank lines are ignored.</summary>
    public static List<string> SplitAltNames(string? text) =>
        (text ?? "").Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    /// <summary>The SAN must be an absolute URI because it is compared with the iss claim verbatim.</summary>
    public static bool IsValidAltName(string? altName) =>
        !string.IsNullOrWhiteSpace(altName)
        && altName.Length <= MaxAltNameLength
        && Uri.TryCreate(altName, UriKind.Absolute, out _);

    public async Task<byte[]> GenerateAsync(IReadOnlyList<string> altNames, string password, CertScenario scenario, CertKeyType keyType, CancellationToken ct)
    {
        using var rootCert = CertUtil.LoadFromFileOrEncoded(_config.RootCertFile, true, _config.RootCertPassword)
            ?? throw new InvalidOperationException("Could not load root certificate");
        using var intermediateCert = CertUtil.LoadFromFileOrEncoded(_config.IntermediateCertFile, true, _config.IntermediateCertPassword)
            ?? throw new InvalidOperationException("Could not load intermediate certificate");

        var issuer = scenario.UntrustedIssuer
            ? CertificateTooling.BuildThrowawayCa("Untrusted")
            : new IssuingCa(rootCert, intermediateCert);

        try
        {
            var x500Builder = new X500DistinguishedNameBuilder();
            x500Builder.AddCommonName(altNames[0]);
            x500Builder.AddOrganizationalUnitName("UDAP Testing");
            x500Builder.AddOrganizationName("FAST Security");
            x500Builder.AddLocalityName("Locality");
            x500Builder.AddStateOrProvinceName("State");
            x500Builder.AddCountryOrRegion("US");

            var options = scenario.Shape(new ClientCertificateOptions(
                x500Builder.Build(),
                altNames.ToList(),
                CrlUrl: _config.IntermediateCrlUrl,
                AiaCertUrl: _config.IntermediateCertUrl,
                NotBefore: DateTimeOffset.UtcNow.AddDays(-1),
                NotAfter: DateTimeOffset.UtcNow.AddYears(2),
                Password: password,
                KeyType: keyType));

            var pfx = CertificateTooling.BuildUdapClientCertificate(issuer.Intermediate, issuer.Root, options);

            if (scenario.RevokeAfterIssue)
            {
                // Each cert in the loaded collection holds a native handle, so dispose them all once the leaf is revoked.
                var collection = X509CertificateLoader.LoadPkcs12Collection(pfx, password);
                try
                {
                    await revocationStore.RevokeAsync(collection.First(c => c.HasPrivateKey), X509RevocationReason.KeyCompromise, ct);
                }
                finally
                {
                    foreach (var c in collection)
                    {
                        c.Dispose();
                    }
                }
            }

            return pfx;
        }
        finally
        {
            if (scenario.UntrustedIssuer)
            {
                issuer.Root.Dispose();
                issuer.Intermediate.Dispose();
            }
        }
    }
}
