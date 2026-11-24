using System.Collections.Specialized;
using System.Security.Claims;
using Duende.IdentityModel;
using Duende.IdentityServer;
using Duende.IdentityServer.Configuration;
using Duende.IdentityServer.Models;
using Duende.IdentityServer.ResponseHandling;
using Duende.IdentityServer.Services;
using Duende.IdentityServer.Validation;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IdentityServer.Tests;

public class FhirPersonaInteractionResponseGeneratorTests
{
    // The key of the processed prompt marker. Duende declares it as Constants.ProcessedPrompt in an internal class (tag is-8.0.10).
    private const string Marker = "suppressed_prompt";
    private const string BaseA = "http://localhost:8090/fhir";
    private const string BaseB = "http://localhost:8091/fhir";
    private static readonly string[] OneLoginMarker = [OidcConstants.PromptModes.Login];

    private static readonly FhirPersonaInteractionResponseGenerator Generator = new(
        new IdentityServerOptions(), TimeProvider.System, NullLogger<AuthorizeInteractionResponseGenerator>.Instance, new NoConsent(), new ActiveProfile());

    private static readonly ClaimsPrincipal SignedOut = new(new ClaimsIdentity());

    private static ClaimsPrincipal Session(string type, string id)
    {
        var user = FhirPersona.CreateUser(BaseA, type, id, null);
        user.IdentityProvider = IdentityServerConstants.LocalIdentityProvider;
        return user.CreatePrincipal();
    }

    // A return pass is set up as the validator sets it: the marker in the raw parameters, the processed prompt, and the prompt modes without it.
    private static ValidatedAuthorizeRequest Request(
        ClaimsPrincipal subject, string? loginHint, string scopes = "openid", string aud = BaseA, string[]? prompt = null, bool returnPass = false)
    {
        var raw = new NameValueCollection { ["aud"] = aud };
        if (loginHint is not null)
        {
            raw[OidcConstants.AuthorizeRequest.LoginHint] = loginHint;
        }

        string[] original = prompt ?? [];
        string[] processed = returnPass ? [OidcConstants.PromptModes.Login] : [];
        if (returnPass)
        {
            raw.Add(Marker, OidcConstants.PromptModes.Login);
        }

        return new ValidatedAuthorizeRequest
        {
            Client = new Client { ClientId = "client" },
            Subject = subject,
            Raw = raw,
            LoginHint = loginHint,
            RequestedScopes = [.. scopes.Split(' ')],
            AuthenticationContextReferenceClasses = [],
            OriginalPromptModes = original,
            ProcessedPromptModes = processed,
            PromptModes = original.Except(processed).ToArray(),
        };
    }

    private static Task<InteractionResponse> Process(ValidatedAuthorizeRequest request) =>
        Generator.ProcessInteractionAsync(request, null!, CancellationToken.None);

    [Fact]
    public async Task First_pass_with_a_hint_for_a_different_resource_shows_the_login_page_and_marks_the_request()
    {
        var request = Request(Session("Patient", "pat-a"), "Patient/pat-b");

        var response = await Process(request);

        Assert.True(response.IsLogin);
        Assert.Equal(OneLoginMarker, request.Raw.GetValues(Marker));
        Assert.Empty(request.PromptModes);
    }

    [Fact]
    public async Task Return_pass_does_not_apply_the_different_resource_rule_again()
    {
        var request = Request(Session("Patient", "pat-a"), "Patient/pat-b", returnPass: true);

        var response = await Process(request);

        Assert.False(response.IsLogin);
        Assert.False(response.IsError);
        Assert.Equal(OneLoginMarker, request.Raw.GetValues(Marker));
    }

    [Fact]
    public async Task Return_pass_asks_for_a_sign_in_when_aud_names_a_different_server()
    {
        var request = Request(Session("Patient", "pat-a"), "Patient/pat-b", aud: BaseB, returnPass: true);

        var response = await Process(request);

        Assert.True(response.IsLogin);
        Assert.Equal(OneLoginMarker, request.Raw.GetValues(Marker));
    }

    [Fact]
    public async Task Return_pass_asks_for_a_sign_in_when_the_session_has_no_patient_for_a_patient_scope()
    {
        var request = Request(Session("Practitioner", "prac-1"), null, scopes: "openid patient/Observation.rs", returnPass: true);

        var response = await Process(request);

        Assert.True(response.IsLogin);
        Assert.Equal(OneLoginMarker, request.Raw.GetValues(Marker));
    }

    [Fact]
    public async Task First_pass_with_no_session_and_a_resource_hint_marks_the_request()
    {
        var request = Request(SignedOut, "Patient/pat-b");

        var response = await Process(request);

        Assert.True(response.IsLogin);
        Assert.Equal(OneLoginMarker, request.Raw.GetValues(Marker));
    }

    [Fact]
    public async Task First_pass_with_prompt_login_from_the_client_writes_one_marker()
    {
        var request = Request(Session("Patient", "pat-a"), "Patient/pat-b", prompt: [OidcConstants.PromptModes.Login]);

        var response = await Process(request);

        Assert.True(response.IsLogin);
        Assert.Equal(OneLoginMarker, request.Raw.GetValues(Marker));
    }

    [Fact]
    public async Task Prompt_none_gives_login_required_and_adds_no_prompt()
    {
        var request = Request(Session("Patient", "pat-a"), "Patient/pat-b", prompt: [OidcConstants.PromptModes.None]);

        var response = await Process(request);

        Assert.Equal(OidcConstants.AuthorizeErrors.LoginRequired, response.Error);
        Assert.Null(request.Raw.GetValues(Marker));
        Assert.Equal(new[] { OidcConstants.PromptModes.None }, request.PromptModes);
    }

    [Fact]
    public async Task Session_of_the_hinted_resource_continues_and_the_request_is_unchanged()
    {
        var request = Request(Session("Patient", "pat-a"), "Patient/pat-a");

        var response = await Process(request);

        Assert.False(response.IsLogin);
        Assert.False(response.IsError);
        Assert.Null(request.Raw.GetValues(Marker));
        Assert.Equal(2, request.Raw.Count);
        Assert.Empty(request.PromptModes);
    }

    [Fact]
    public async Task Resource_session_with_the_udap_scope_asks_for_a_sign_in_on_both_passes()
    {
        var firstPass = Request(Session("Patient", "pat-a"), null, scopes: "openid udap");
        var returnPass = Request(Session("Patient", "pat-a"), null, scopes: "openid udap", returnPass: true);

        Assert.True((await Process(firstPass)).IsLogin);
        Assert.Equal(OneLoginMarker, firstPass.Raw.GetValues(Marker));
        Assert.True((await Process(returnPass)).IsLogin);
        Assert.Equal(OneLoginMarker, returnPass.Raw.GetValues(Marker));
    }

    private sealed class ActiveProfile : IProfileService
    {
        public Task GetProfileDataAsync(ProfileDataRequestContext context, CancellationToken ct) => Task.CompletedTask;

        public Task IsActiveAsync(IsActiveContext context, CancellationToken ct)
        {
            context.IsActive = true;
            return Task.CompletedTask;
        }
    }

    private sealed class NoConsent : IConsentService
    {
        public Task<bool> RequiresConsentAsync(ClaimsPrincipal subject, Client client, IEnumerable<ParsedScopeValue> parsedScopes, CancellationToken ct) =>
            Task.FromResult(false);

        public Task UpdateConsentAsync(ClaimsPrincipal subject, Client client, IEnumerable<ParsedScopeValue> parsedScopes, CancellationToken ct) =>
            Task.CompletedTask;
    }
}
