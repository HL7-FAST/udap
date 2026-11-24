using System.Security.Claims;
using Duende.IdentityServer;
using Duende.IdentityServer.Models;
using Duende.IdentityServer.Services;
using Duende.IdentityServer.Validation;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IdentityServer.Tests;

public class FhirPersonaClaimsServiceTests
{
    private sealed class NoClaimsProfileService : IProfileService
    {
        public Task GetProfileDataAsync(ProfileDataRequestContext context, CancellationToken ct) => Task.CompletedTask;

        public Task IsActiveAsync(IsActiveContext context, CancellationToken ct) => Task.CompletedTask;
    }

    private sealed class FhirUserProfileService : IProfileService
    {
        public Task GetProfileDataAsync(ProfileDataRequestContext context, CancellationToken ct)
        {
            context.IssuedClaims.AddRange(context.Subject.FindAll("fhirUser"));
            return Task.CompletedTask;
        }

        public Task IsActiveAsync(IsActiveContext context, CancellationToken ct) => Task.CompletedTask;
    }

    private static readonly DateTime SignInTime = new(2026, 11, 18, 0, 0, 0, DateTimeKind.Utc);

    // The Duende sign-in adds idp and auth_time to each session. The base method reads both when it builds the ID token claims.
    private static ClaimsPrincipal SessionA()
    {
        var user = FhirPersona.CreateUser("http://localhost:8090/fhir", "Patient", "pat-a", null);
        user.IdentityProvider = IdentityServerConstants.LocalIdentityProvider;
        user.AuthenticationTime = SignInTime;
        return user.CreatePrincipal();
    }

    private static ClaimsPrincipal PasswordSession() => new IdentityServerUser("3")
    {
        IdentityProvider = IdentityServerConstants.LocalIdentityProvider,
        AuthenticationTime = SignInTime,
        AuthenticationMethods = { "pwd" },
    }.CreatePrincipal();

    private static Task<IReadOnlyCollection<Claim>> IdTokenClaims(
        DefaultClaimsService service, ClaimsPrincipal subject, string scopes, bool includeAllIdentityClaims = false) =>
        service.GetIdentityTokenClaimsAsync(
            subject,
            new ResourceValidationResult(new Resources(), scopes.Split(' ').Select(s => new ParsedScopeValue(s))),
            includeAllIdentityClaims,
            new ValidatedRequest { Client = new Client { ClientId = "client" } },
            CancellationToken.None);

    private static FhirPersonaClaimsService Service(IProfileService? profile = null) =>
        new(profile ?? new NoClaimsProfileService(), NullLogger<DefaultClaimsService>.Instance);

    [Fact]
    public async Task Id_token_of_a_resource_session_with_the_fhirUser_scope_has_fhirUser_one_time()
    {
        var claims = await IdTokenClaims(Service(), SessionA(), "openid fhirUser");

        var fhirUser = Assert.Single(claims, c => c.Type == "fhirUser");
        Assert.Equal("http://localhost:8090/fhir/Patient/pat-a", fhirUser.Value);
    }

    [Fact]
    public async Task Id_token_with_fhirUser_from_the_profile_service_has_fhirUser_one_time()
    {
        var claims = await IdTokenClaims(Service(new FhirUserProfileService()), SessionA(), "openid fhirUser", includeAllIdentityClaims: true);

        Assert.Single(claims, c => c.Type == "fhirUser");
    }

    [Fact]
    public async Task Id_token_with_no_fhirUser_scope_has_no_fhirUser()
    {
        var claims = await IdTokenClaims(Service(), SessionA(), "openid");

        Assert.DoesNotContain(claims, c => c.Type == "fhirUser");
    }

    [Fact]
    public async Task Id_token_of_a_password_session_is_the_base_result()
    {
        var baseService = new DefaultClaimsService(new NoClaimsProfileService(), NullLogger<DefaultClaimsService>.Instance);

        var expected = await IdTokenClaims(baseService, PasswordSession(), "openid fhirUser");
        var actual = await IdTokenClaims(Service(), PasswordSession(), "openid fhirUser");

        Assert.Equal(expected.Select(c => (c.Type, c.Value)), actual.Select(c => (c.Type, c.Value)));
    }
}
