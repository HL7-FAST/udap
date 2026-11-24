using System.Security.Claims;
using Duende.IdentityServer.Services;
using Duende.IdentityServer.Validation;

namespace IdentityServer;

/// <summary>Adds the fhirUser claim of a resource session to its ID token, for each client. Each other subject gets the base result.</summary>
public class FhirPersonaClaimsService(IProfileService profile, ILogger<DefaultClaimsService> logger)
    : DefaultClaimsService(profile, logger)
{
    public override async Task<IReadOnlyCollection<Claim>> GetIdentityTokenClaimsAsync(
        ClaimsPrincipal subject, ResourceValidationResult resources, bool includeAllIdentityClaims,
        ValidatedRequest request, CancellationToken ct)
    {
        var claims = await base.GetIdentityTokenClaimsAsync(subject, resources, includeAllIdentityClaims, request, ct);
        var fhirUser = FhirPersona.FhirUserForIdToken(subject, resources.RawScopeValues);

        return fhirUser is null || claims.Any(c => c.Type == FhirPersona.FhirUserClaim) ? claims : [.. claims, fhirUser];
    }
}
