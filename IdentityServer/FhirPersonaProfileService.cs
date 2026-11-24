using Duende.IdentityServer;
using Duende.IdentityServer.Models;
using Duende.IdentityServer.Test;

namespace IdentityServer;

/// <summary>A resource sign-in has no stored user, so its claims come from its session. Each other subject gets the result of the base class.</summary>
public class FhirPersonaProfileService(TestUserStore users, ILogger<TestUserProfileService> logger)
    : TestUserProfileService(users, logger)
{
    public override Task GetProfileDataAsync(ProfileDataRequestContext context, CancellationToken ct)
    {
        if (!FhirPersona.IsPersona(context.Subject))
        {
            return base.GetProfileDataAsync(context, ct);
        }

        // The session keeps fhir_base to compare it with the aud of a later request, and no token needs it.
        context.AddRequestedClaims(context.Subject.Claims.Where(c => c.Type != FhirPersona.BaseClaim));

        // Only the access token carries the patient in context. A SMART client reads it from the token response.
        context.IssuedClaims.RemoveAll(c => c.Type == FhirPersona.PatientClaim);
        var patient = context.Subject.FindFirst(FhirPersona.PatientClaim);
        if (patient is not null
            && FhirPersona.WantsPatient(context.RequestedResources?.RawScopeValues)
            && context.Caller == IdentityServerConstants.ProfileDataCallers.ClaimsProviderAccessToken)
        {
            context.IssuedClaims.Add(patient);
        }

        context.LogIssuedClaims(Logger);
        return Task.CompletedTask;
    }

    public override Task IsActiveAsync(IsActiveContext context, CancellationToken ct)
    {
        if (!FhirPersona.IsPersona(context.Subject))
        {
            return base.IsActiveAsync(context, ct);
        }

        context.IsActive = true;
        return Task.CompletedTask;
    }
}
