using Duende.IdentityServer.ResponseHandling;
using IdentityServer.Models;
using Microsoft.Extensions.Options;
using Udap.Common.Certificates;
using Udap.Common.Models;
using Udap.Model;

namespace IdentityServer;

/// <summary>
/// Supplies the options for the signed UDAP metadata at /.well-known/udap
/// </summary>
public class UdapMetadataOptionsProvider(
    IOptions<AppConfig> appConfig,
    IHttpContextAccessor httpContextAccessor,
    IDiscoveryResponseGenerator discovery,
    IPrivateCertificateStore certificateStore) : IUdapMetadataOptionsProvider
{
    private UdapMetadataOptions? _value;

    public UdapMetadataOptions Value => _value ??= BuildAsync().GetAwaiter().GetResult();

    private async Task<UdapMetadataOptions> BuildAsync()
    {
        var baseUrl = appConfig.Value.UdapIdpBaseUrl.TrimEnd('/');
        var cancellation = httpContextAccessor.HttpContext?.RequestAborted ?? CancellationToken.None;

        var document = await discovery.CreateDiscoveryDocumentAsync(baseUrl, baseUrl, cancellation);
        var store = await certificateStore.Resolve(cancellation);

        return new UdapMetadataOptions
        {
            UdapVersionsSupported = ["1"],
            UdapProfilesSupported = ["udap_dcr", "udap_authn", "udap_authz", "udap_to"],
            UdapAuthorizationExtensionsSupported = ["hl7-b2b"],
            GrantTypesSupported = ["authorization_code", "refresh_token", "client_credentials"],
            ScopesSupported = [.. (IEnumerable<string>)document["scopes_supported"]],
            UdapMetadataConfigs =
            [
                .. CommunitiesFor(baseUrl, store.IssuedCertificates).Select(community => new UdapMetadataConfig
                {
                    Community = community,
                    SignedMetadataConfig = new SignedMetadataConfig
                    {
                        AuthorizationEndpoint = (string)document["authorization_endpoint"],
                        TokenEndpoint = (string)document["token_endpoint"],
                        RegistrationEndpoint = (string)document["registration_endpoint"]
                    }
                })
            ]
        };
    }

    public static IEnumerable<string> CommunitiesFor(string baseUrl, IEnumerable<IssuedCertificate> certificates)
    {
        var expected = Normalize(baseUrl);
        return certificates
            .Where(c => c.SubjectAltNames.Any(san => Normalize(san) == expected))
            .Select(c => c.Community)
            .Distinct();
    }

    private static string? Normalize(string uri) =>
        Uri.TryCreate(uri.TrimEnd('/'), UriKind.Absolute, out var parsed) ? parsed.AbsoluteUri : null;
}
