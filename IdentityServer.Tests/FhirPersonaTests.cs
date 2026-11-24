using System.Security.Claims;
using Duende.IdentityServer;
using Xunit;

namespace IdentityServer.Tests;

public class FhirPersonaTests
{
    private const string BaseA = "http://localhost:8090/fhir";

    private static ClaimsPrincipal? Session(string session) => session switch
    {
        "none" => null,
        "A" => FhirPersona.CreateUser(BaseA, "Patient", "pat-a", null).CreatePrincipal(),
        "password" => Password(),
        "prac-1" => FhirPersona.CreateUser(BaseA, "Practitioner", "prac-1", null).CreatePrincipal(),
        "prac-1, patient pat-b" => FhirPersona.CreateUser(BaseA, "Practitioner", "prac-1", "pat-b").CreatePrincipal(),
        "unauthenticated, sub 3" => new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", "3")])),
        _ => throw new ArgumentOutOfRangeException(nameof(session), session, null),
    };

    private static ClaimsPrincipal Password(params Claim[] more) =>
        new(new ClaimsIdentity([new Claim("sub", "3"), .. more], "password"));

    [Fact]
    public void SubjectFor_is_the_prefix_and_the_hash_of_base_type_and_id()
    {
        Assert.Equal("fhirp-83a4509f0f22a0ebd8baab0ae9ff0b81d0cab1efcb18f5e3c470c37edb8966e3",
            FhirPersona.SubjectFor("http://localhost:8090/fhir", "Patient", "pat-a"));
        Assert.Equal("fhirp-5724b8fe7f9bd2e8a0a0a4368c19e324e395767203cc0eb52d2d974d6d743a24",
            FhirPersona.SubjectFor("https://x.example/fhir//", "Practitioner", "prac-1"));
    }

    [Theory]
    [InlineData("https://x.example/fhir", true)]
    [InlineData("http://localhost:8080/fhir/", true)]
    [InlineData("ftp://x.example/fhir", false)]
    [InlineData("/fhir", false)]
    [InlineData("x.example/fhir", false)]
    [InlineData("https://x.example/fhir?a=b", false)]
    [InlineData("https://x.example/fhir?", false)]
    [InlineData("https://x.example/fhir#f", false)]
    [InlineData("https://x.example/fhir#", false)]
    [InlineData("http://user:secret@x.example/fhir", false)]
    [InlineData("https://x.example/fhir ", false)]
    [InlineData(@"https://x.example/fhir\a", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsValidBase_accepts_an_absolute_http_url_with_no_query_and_no_fragment(string? value, bool expected)
        => Assert.Equal(expected, FhirPersona.IsValidBase(value));

    [Theory]
    [InlineData("Patient/pat-a", true, "Patient", "pat-a")]
    [InlineData("Person/1", true, "Person", "1")]
    [InlineData("PractitionerRole/x", false, "", "")]
    [InlineData("patient/pat-a", false, "", "")]
    [InlineData("bob@example.org", false, "", "")]
    [InlineData("Patient/", false, "", "")]
    [InlineData("Patient/a/b", false, "", "")]
    [InlineData("Patient/a b", false, "", "")]
    [InlineData("Patient/a\n", false, "", "")]
    [InlineData(null, false, "", "")]
    public void TryParseHint_accepts_one_of_the_four_types_and_a_fhir_id(string? hint, bool ok, string type, string id)
    {
        Assert.Equal(ok, FhirPersona.TryParseHint(hint, out var parsedType, out var parsedId));
        Assert.Equal(type, parsedType);
        Assert.Equal(id, parsedId);
    }

    [Fact]
    public void FhirUserFor_removes_trailing_slashes_of_the_base()
        => Assert.Equal("https://x.example/fhir/Practitioner/prac-1", FhirPersona.FhirUserFor("https://x.example/fhir/", "Practitioner", "prac-1"));

    [Fact]
    public void CreateUser_gives_a_patient_its_own_id_as_patient()
    {
        var principal = FhirPersona.CreateUser("http://localhost:8090/fhir/", "Patient", "pat-a", null).CreatePrincipal();

        Assert.Equal("fhirp-83a4509f0f22a0ebd8baab0ae9ff0b81d0cab1efcb18f5e3c470c37edb8966e3", principal.FindFirst("sub")?.Value);
        Assert.Contains("fhir-persona", principal.FindAll("amr").Select(c => c.Value));
        Assert.Equal("http://localhost:8090/fhir/Patient/pat-a", principal.FindFirst("name")?.Value);
        Assert.Equal("http://localhost:8090/fhir/Patient/pat-a", principal.FindFirst("fhirUser")?.Value);
        Assert.Equal("http://localhost:8090/fhir", principal.FindFirst("fhir_base")?.Value);
        Assert.Equal("pat-a", principal.FindFirst("patient")?.Value);
    }

    [Fact]
    public void CreateUser_gives_a_practitioner_a_patient_only_when_one_is_given()
    {
        var withPatient = FhirPersona.CreateUser(BaseA, "Practitioner", "prac-1", "pat-b").CreatePrincipal();
        var withoutPatient = FhirPersona.CreateUser(BaseA, "Practitioner", "prac-1", null).CreatePrincipal();

        Assert.Equal("pat-b", withPatient.FindFirst("patient")?.Value);
        Assert.Null(withoutPatient.FindFirst("patient"));
    }

    [Theory]
    [InlineData("none", "http://localhost:8091/fhir", "Patient/pat-b", "openid", NewSignInReason.None)]
    [InlineData("A", "http://localhost:8090/fhir", null, "openid", NewSignInReason.None)]
    [InlineData("A", "http://localhost:8090/fhir/", null, "openid", NewSignInReason.None)]
    [InlineData("A", "http://localhost:8091/fhir", null, "openid", NewSignInReason.OtherServer)]
    [InlineData("A", null, null, "openid", NewSignInReason.None)]
    [InlineData("A", "http://localhost:8090/fhir", "Patient/pat-a", "openid", NewSignInReason.None)]
    [InlineData("A", "http://localhost:8090/fhir", "Patient/pat-b", "openid", NewSignInReason.OtherResource)]
    [InlineData("A", "http://localhost:8090/fhir", "bob@example.org", "openid", NewSignInReason.None)]
    [InlineData("password", null, "Patient/pat-a", "openid", NewSignInReason.OtherResource)]
    [InlineData("A", "http://localhost:8091/fhir", "Patient/pat-b", "openid udap", NewSignInReason.TieredRequest)]
    [InlineData("prac-1", "http://localhost:8090/fhir", null, "patient/Observation.rs", NewSignInReason.NoPatient)]
    [InlineData("prac-1, patient pat-b", "http://localhost:8090/fhir", null, "patient/Observation.rs", NewSignInReason.None)]
    [InlineData("prac-1", "http://localhost:8090/fhir", null, "user/Observation.rs", NewSignInReason.None)]
    [InlineData("A", "http://localhost:8090/fhir", null, "launch/patient", NewSignInReason.None)]
    [InlineData("unauthenticated, sub 3", null, "Patient/pat-a", "openid", NewSignInReason.None)]
    [InlineData("A", "http://localhost:8091/fhir", "Patient/pat-b", "openid", NewSignInReason.OtherServer)]
    [InlineData("A", null, null, "openid udap", NewSignInReason.TieredRequest)]
    [InlineData("password", null, "Patient/pat-a", "openid udap", NewSignInReason.None)]
    public void NewSignInReasonFor_names_the_first_rule_that_asks_for_a_new_sign_in(
        string session, string? aud, string? loginHint, string scopes, NewSignInReason expected)
        => Assert.Equal(expected, FhirPersona.NewSignInReasonFor(Session(session), aud, loginHint, scopes.Split(' ')));

    [Theory]
    [InlineData("none", "http://localhost:8090/fhir", "Patient/pat-a", "auto", "openid patient/Observation.rs", null, AutoSignInRefusal.None)]
    [InlineData("none", "http://localhost:8090/fhir", "Patient/pat-a", null, "openid patient/Observation.rs", null, AutoSignInRefusal.NotRequested)]
    [InlineData("none", "http://localhost:8090/fhir", "Patient/pat-a", "AUTO", "openid patient/Observation.rs", null, AutoSignInRefusal.NotRequested)]
    [InlineData("none", null, "Patient/pat-a", "auto", "openid patient/Observation.rs", null, AutoSignInRefusal.NoBase)]
    [InlineData("none", "http://localhost:8090/fhir", "bob@example.org", "auto", "openid patient/Observation.rs", null, AutoSignInRefusal.NoResourceHint)]
    [InlineData("none", "http://localhost:8090/fhir", "Practitioner/prac-1", "auto", "openid patient/Observation.rs", null, AutoSignInRefusal.NoPatient)]
    [InlineData("none", "http://localhost:8090/fhir", "Practitioner/prac-1", "auto", "openid user/Observation.rs", null, AutoSignInRefusal.None)]
    [InlineData("A", "http://localhost:8090/fhir", "Patient/pat-a", "auto", "openid patient/Observation.rs", null, AutoSignInRefusal.None)]
    [InlineData("password", "http://localhost:8090/fhir", "Patient/pat-a", "auto", "openid patient/Observation.rs", null, AutoSignInRefusal.OtherSession)]
    [InlineData("none", "http://localhost:8090/fhir", "Patient/pat-a", "auto", "openid udap", null, AutoSignInRefusal.Tiered)]
    [InlineData("unauthenticated, sub 3", "http://localhost:8090/fhir", "Patient/pat-a", "auto", "openid patient/Observation.rs", null, AutoSignInRefusal.None)]
    [InlineData("none", "http://localhost:8090/fhir", "Patient/pat-a", "auto", "openid patient/Observation.rs", "other-idp", AutoSignInRefusal.IdentityProvider)]
    [InlineData("none", "http://localhost:8090/fhir", "Patient/pat-a", "auto", "openid patient/Observation.rs", IdentityServerConstants.LocalIdentityProvider, AutoSignInRefusal.None)]
    public void AutoSignInRefusalFor_names_the_first_condition_that_does_not_hold(
        string session, string? aud, string? loginHint, string? signInParameter, string scopes, string? identityProvider, AutoSignInRefusal expected)
        => Assert.Equal(expected, FhirPersona.AutoSignInRefusalFor(Session(session), aud, loginHint, signInParameter, scopes.Split(' '), identityProvider));

    [Fact]
    public void PatientForResponse_gives_the_patient_only_for_a_patient_level_scope()
    {
        var a = Session("A");

        Assert.Equal("pat-a", FhirPersona.PatientForResponse(a, ["launch/patient"]));
        Assert.Equal("pat-a", FhirPersona.PatientForResponse(a, ["patient/Observation.rs"]));
        Assert.Null(FhirPersona.PatientForResponse(a, ["user/Observation.rs"]));
        Assert.Null(FhirPersona.PatientForResponse(null, ["launch/patient"]));
        Assert.Null(FhirPersona.PatientForResponse(Password(new Claim("patient", "pat-a")), ["patient/Observation.rs"]));
    }

    [Fact]
    public void FhirUserForIdToken_gives_the_claim_only_to_a_resource_session_with_the_fhirUser_scope()
    {
        var claim = FhirPersona.FhirUserForIdToken(Session("A"), ["openid", "fhirUser"]);

        Assert.Equal("fhirUser", claim?.Type);
        Assert.Equal("http://localhost:8090/fhir/Patient/pat-a", claim?.Value);
        Assert.Null(FhirPersona.FhirUserForIdToken(Session("A"), ["openid"]));
        Assert.Null(FhirPersona.FhirUserForIdToken(Session("password"), ["openid", "fhirUser"]));
        Assert.Null(FhirPersona.FhirUserForIdToken(
            Password(new Claim("fhirUser", "http://localhost:8090/fhir/Patient/pat-a")), ["openid", "fhirUser"]));
    }

    [Fact]
    public void FhirUserForIdToken_compares_scopes_by_ordinal_value()
    {
        var scopes = new HashSet<string>(["openid", "FHIRUSER"], StringComparer.OrdinalIgnoreCase);

        Assert.Null(FhirPersona.FhirUserForIdToken(Session("A"), scopes));
    }

    [Fact]
    public void IsTieredRequest_compares_scopes_by_ordinal_value()
    {
        var scopes = new HashSet<string>(["openid", "UDAP"], StringComparer.OrdinalIgnoreCase);

        Assert.False(FhirPersona.IsTieredRequest(scopes));
    }
}
