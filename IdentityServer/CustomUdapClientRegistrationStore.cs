using System.Security.Cryptography.X509Certificates;
using Duende.IdentityServer.Models;
using Udap.Common.Models;
using Udap.Server.Storage.Stores;

namespace IdentityServer;

/// <summary>
/// Decorator that fixes FindTieredClientById returning a default/empty TieredClient
/// instead of null when called with a non-matching value (e.g., an IdP URL).
/// This bug in HandleChallengeAsync prevents idpClientId from being set
/// from the DCR result, causing client_id to be omitted from the authorize URL.
/// </summary>
public class CustomUdapClientRegistrationStore : IUdapClientRegistrationStore
{
    private readonly IUdapClientRegistrationStore _inner;

    public CustomUdapClientRegistrationStore(IUdapClientRegistrationStore inner)
    {
        _inner = inner;
    }

    public async Task<TieredClient?> FindTieredClientById(string clientId, CancellationToken token = default)
    {
        var result = await _inner.FindTieredClientById(clientId, token);

        if (result != null && string.IsNullOrEmpty(result.ClientId))
        {
            return null;
        }

        return result;
    }

    // Delegate all other members to the inner store
    public Task<Client?> GetClient(Client client, CancellationToken token = default)
        => _inner.GetClient(client, token);

    public Task<bool> UpsertClient(Client client, CancellationToken token = default)
        => _inner.UpsertClient(client, token);

    public Task<bool> UpsertTieredClient(TieredClient client, CancellationToken token = default)
        => _inner.UpsertTieredClient(client, token);

    public Task<int> CancelRegistration(Client client, CancellationToken token = default)
        => _inner.CancelRegistration(client, token);

    public Task<IEnumerable<Anchor>> GetAnchors(string? community, CancellationToken token = default)
        => _inner.GetAnchors(community, token);

    public Task<IEnumerable<X509Certificate2>?> GetCommunityCertificates(long communityId, CancellationToken token = default)
        => _inner.GetCommunityCertificates(communityId, token);

    public Task<X509Certificate2Collection?> GetIntermediateCertificates(CancellationToken token = default)
        => _inner.GetIntermediateCertificates(token);

    public Task<X509Certificate2Collection?> GetAnchorsCertificates(string? community, CancellationToken token = default)
        => _inner.GetAnchorsCertificates(community, token);

    public Task<int?> GetCommunityId(string community, CancellationToken token = default)
        => _inner.GetCommunityId(community, token);

    public Task<ICollection<Secret>?> RolloverClientSecrets(Udap.Common.Models.ParsedSecret secret, CancellationToken token = default)
        => _inner.RolloverClientSecrets(secret, token);
}
