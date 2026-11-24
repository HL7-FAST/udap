using System.Security.Claims;
using Duende.IdentityModel;
using Duende.IdentityServer;
using Duende.IdentityServer.Models;
using Duende.IdentityServer.Services;
using Duende.IdentityServer.Test;
using Duende.IdentityServer.Validation;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IdentityServer.Tests;

public class FhirPersonaProfileServiceTests
{
    private const string AccessToken = IdentityServerConstants.ProfileDataCallers.ClaimsProviderAccessToken;
    private const string IdentityToken = IdentityServerConstants.ProfileDataCallers.ClaimsProviderIdentityToken;
    private const string UserInfo = IdentityServerConstants.ProfileDataCallers.UserInfoEndpoint;

    private static readonly TestUserStore Users = new(
    [
        new TestUser { SubjectId = "3", Username = "user", Claims = { new Claim(JwtClaimTypes.Name, "Test User") } },
    ]);

    private static readonly ClaimsPrincipal SessionA =
        FhirPersona.CreateUser("http://localhost:8090/fhir", "Patient", "pat-a", null).CreatePrincipal();

    private static readonly ClaimsPrincipal TestUserSession = new(new ClaimsIdentity([new Claim("sub", "3")], "password"));

    private static FhirPersonaProfileService Service() => new(Users, NullLogger<TestUserProfileService>.Instance);

    private static async Task<List<Claim>> Issued(
        ClaimsPrincipal subject, string caller, string[] claimTypes, string? scope, IProfileService? service = null)
    {
        var context = new ProfileDataRequestContext(subject, new Client { ClientId = "client" }, caller, claimTypes);
        if (scope is not null)
        {
            context.RequestedResources = new ResourceValidationResult(new Resources(), [new ParsedScopeValue(scope)]);
        }

        await (service ?? Service()).GetProfileDataAsync(context, CancellationToken.None);
        return context.IssuedClaims;
    }

    private static async Task<bool> IsActive(ClaimsPrincipal subject, bool initial)
    {
        var context = new IsActiveContext(subject, new Client { ClientId = "client" },
            IdentityServerConstants.ProfileIsActiveCallers.AccessTokenValidation) { IsActive = initial };
        await Service().IsActiveAsync(context, CancellationToken.None);
        return context.IsActive;
    }

    [Fact]
    public async Task Access_token_of_a_resource_session_gets_fhirUser_and_patient()
    {
        var claims = await Issued(SessionA, AccessToken, ["fhirUser"], "patient/Observation.rs");

        Assert.Contains(claims, c => c.Type == "fhirUser" && c.Value == "http://localhost:8090/fhir/Patient/pat-a");
        Assert.Contains(claims, c => c.Type == "patient" && c.Value == "pat-a");
        Assert.DoesNotContain(claims, c => c.Type == "fhir_base");
    }

    [Fact]
    public async Task Access_token_gets_no_session_claim_when_a_resource_requests_one()
    {
        var claims = await Issued(SessionA, AccessToken, ["fhirUser", "fhir_base"], "patient/Observation.rs");

        Assert.Contains(claims, c => c.Type == "fhirUser");
        Assert.DoesNotContain(claims, c => c.Type == "fhir_base");
    }

    [Fact]
    public async Task Access_token_with_no_patient_level_scope_gets_no_patient()
    {
        var claims = await Issued(SessionA, AccessToken, ["fhirUser"], "user/Observation.rs");

        Assert.DoesNotContain(claims, c => c.Type == "patient");
    }

    [Fact]
    public async Task Identity_token_call_gets_no_patient()
    {
        var claims = await Issued(SessionA, IdentityToken, ["fhirUser", "patient"], "patient/Observation.rs");

        Assert.DoesNotContain(claims, c => c.Type == "patient");
    }

    [Fact]
    public async Task Call_with_no_requested_resources_does_not_throw()
    {
        var claims = await Issued(SessionA, UserInfo, ["hl7_identifier"], null);

        Assert.Empty(claims);
    }

    [Fact]
    public async Task Resource_session_is_active() => Assert.True(await IsActive(SessionA, initial: false));

    [Fact]
    public async Task Unknown_subject_is_not_active() =>
        Assert.False(await IsActive(new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", "nobody")], "password")), initial: true));

    [Fact]
    public async Task Test_user_keeps_the_base_claims()
    {
        var baseService = new TestUserProfileService(Users, NullLogger<TestUserProfileService>.Instance);

        var expected = await Issued(TestUserSession, AccessToken, ["name"], "patient/Observation.rs", baseService);
        var actual = await Issued(TestUserSession, AccessToken, ["name"], "patient/Observation.rs");

        Assert.NotEmpty(expected);
        Assert.Equal(expected.Select(c => (c.Type, c.Value)), actual.Select(c => (c.Type, c.Value)));
    }
}
