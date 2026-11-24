using Duende.IdentityModel;
using Duende.IdentityServer.Configuration;
using Duende.IdentityServer.ResponseHandling;
using Duende.IdentityServer.Services;
using Duende.IdentityServer.Validation;

namespace IdentityServer;

/// <summary>
/// Asks for a sign-in again when the session does not answer the authorize request, by the rules of <see cref="FhirPersona.NewSignInReasonFor"/>.
/// The different resource rule applies one time for each authorize request. The first pass lets the base class process prompt=login,
/// so Duende marks the request. The pass that returns from the login page then has a processed prompt and skips that rule.
/// With prompt=none, the base class changes the login response to the error login_required.
/// </summary>
public class FhirPersonaInteractionResponseGenerator(
    IdentityServerOptions options,
    TimeProvider timeProvider,
    ILogger<AuthorizeInteractionResponseGenerator> logger,
    IConsentService consent,
    IProfileService profile)
    : AuthorizeInteractionResponseGenerator(options, timeProvider, logger, consent, profile)
{
    protected override async Task<InteractionResponse> ProcessLoginAsync(ValidatedAuthorizeRequest request, CancellationToken ct)
    {
        var firstPass = !request.ProcessedPromptModes.Any();
        var loginHint = firstPass ? request.Raw.Get(OidcConstants.AuthorizeRequest.LoginHint) : null;
        var reason = FhirPersona.NewSignInReasonFor(request.Subject, request.Raw.Get("aud"), loginHint, request.RequestedScopes);
        if (reason != NewSignInReason.None)
        {
            Logger.LogInformation("Asking for a new sign-in because the session does not answer the request: {Reason}", reason);
        }

        // Duende asks a browser with no session for a sign-in and writes no processed prompt. For a valid resource hint with no udap scope this class adds login first, unless the request has prompt=none or prompt=login, so Duende writes the marker and the return pass skips the hint.
        var signedOutWithResourceHint = request.Subject?.Identity?.IsAuthenticated != true
            && !FhirPersona.IsTieredRequest(request.RequestedScopes)
            && FhirPersona.TryParseHint(loginHint, out _, out _);
        if (firstPass
            && (reason != NewSignInReason.None || signedOutWithResourceHint)
            && !request.PromptModes.Contains(OidcConstants.PromptModes.None)
            && !request.PromptModes.Contains(OidcConstants.PromptModes.Login))
        {
            // The base class shows the login page for prompt=login and writes the processed prompt into the request. A request whose client sends prompt=login gets the marker with no second prompt value.
            request.PromptModes = [.. request.PromptModes, OidcConstants.PromptModes.Login];
        }

        var response = await base.ProcessLoginAsync(request, ct);
        return response.IsLogin || response.IsError || reason == NewSignInReason.None
            ? response
            : new InteractionResponse { IsLogin = true };
    }
}
