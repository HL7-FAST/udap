using Duende.IdentityServer.ResponseHandling;
using Duende.IdentityServer.Services;
using Duende.IdentityServer.Stores;
using Duende.IdentityServer.Validation;
using Udap.Server.ResponseHandling;

namespace IdentityServer;

/// <summary>
/// Adds the SMART "patient" launch context to the token response of the code and refresh grants.
/// It runs after all validation, so the UDAP token request validator stays in place.
/// </summary>
public class FhirContextTokenResponseGenerator(
    IProfileService profile,
    TimeProvider timeProvider,
    ITokenService tokenService,
    IRefreshTokenService refreshTokenService,
    IScopeParser scopeParser,
    IResourceStore resources,
    IClientStore clients,
    ILogger<TokenResponseGenerator> logger)
    : UdapTokenResponseGenerator(profile, timeProvider, tokenService, refreshTokenService, scopeParser, resources, clients, logger)
{
    protected override async Task<TokenResponse> ProcessAuthorizationCodeRequestAsync(TokenRequestValidationResult request, CancellationToken ct) =>
        AddPatient(await base.ProcessAuthorizationCodeRequestAsync(request, ct), request);

    protected override async Task<TokenResponse> ProcessRefreshTokenRequestAsync(TokenRequestValidationResult request, CancellationToken ct) =>
        AddPatient(await base.ProcessRefreshTokenRequestAsync(request, ct), request);

    private static TokenResponse AddPatient(TokenResponse response, TokenRequestValidationResult request)
    {
        var patient = FhirPersona.PatientForResponse(
            request.ValidatedRequest.Subject, request.ValidatedRequest.ValidatedResources?.RawScopeValues);
        if (patient is not null)
        {
            // The refresh path copies the CustomResponse of the validator, which can be null.
            response.Custom ??= new Dictionary<string, object>();
            response.Custom[FhirPersona.PatientClaim] = patient;
        }

        return response;
    }
}
