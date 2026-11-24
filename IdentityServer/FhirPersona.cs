using System.Diagnostics.CodeAnalysis;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Duende.IdentityServer;
using Udap.Model;

namespace IdentityServer;

/// <summary>Shared rules of the FHIR resource sign-in.</summary>
public static class FhirPersona
{
    public const string SubjectPrefix = "fhirp-";
    public const string Amr = "fhir-persona";
    public const string FhirUserClaim = "fhirUser";
    public const string PatientClaim = "patient";
    // Session claim for the compare with aud. The profile service keeps it out of each token.
    public const string BaseClaim = "fhir_base";
    public const string SignInParameter = "hl7fast_signin";
    public const string SignInAuto = "auto";

    public static readonly string[] ResourceTypes = ["Patient", "Practitioner", "RelatedPerson", "Person"];

    /// <summary>The raw text of the base goes into the subject and into fhirUser, so it must be an exact http or https URL that can take a "/Type/id" suffix.</summary>
    public static bool IsValidBase([NotNullWhen(true)] string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && uri.IsWellFormedOriginalString()
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
        // User information, such as a password in the URL, must not reach fhirUser or the display name.
        && uri.UserInfo.Length == 0
        // A well-formed original string can still have white space at its ends or a no-break space in its path.
        && !value.Any(c => c is '?' or '#' || char.IsWhiteSpace(c));

    /// <summary>"https://x/fhir" and "https://x/fhir/" name one server, so each hash and each compare uses the base with no trailing slash.</summary>
    public static string NormalizeBase(string fhirBase) => fhirBase.TrimEnd('/');

    /// <summary>The id goes into the subject, fhirUser, and the patient claim, so it must follow the FHIR id rule. The end anchor is "\z" because "$" also matches before a final line feed.</summary>
    public static bool IsValidId([NotNullWhen(true)] string? value) =>
        value is not null && Regex.IsMatch(value, @"^[A-Za-z0-9\-\.]{1,64}\z");

    /// <summary>A login_hint of the form "Type/id" names a resource to sign in as. Each other hint, such as an email address, belongs to the password form.</summary>
    public static bool TryParseHint(string? loginHint, out string type, out string id)
    {
        if (loginHint?.Split('/') is [var hintType, var hintId] && ResourceTypes.Contains(hintType) && IsValidId(hintId))
        {
            (type, id) = (hintType, hintId);
            return true;
        }

        (type, id) = ("", "");
        return false;
    }

    /// <summary>The subject never holds the reference itself, and a FHIR id such as "1" never becomes a bare sub that matches a stored user.</summary>
    public static string SubjectFor(string fhirBase, string type, string id) =>
        SubjectPrefix + Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes($"{NormalizeBase(fhirBase)}\n{type}\n{id}")));

    /// <summary>SMART App Launch permits an absolute or a relative fhirUser. One issuer serves many FHIR servers, so the absolute URL says which server the resource is on.</summary>
    public static string FhirUserFor(string fhirBase, string type, string id) => $"{NormalizeBase(fhirBase)}/{type}/{id}";

    /// <summary>No stored user has a subject with the prefix, so the prefix identifies a resource sign-in.</summary>
    public static bool IsPersona(ClaimsPrincipal? subject) =>
        subject?.FindFirst("sub")?.Value.StartsWith(SubjectPrefix, StringComparison.Ordinal) == true;

    /// <summary>These scopes ask for a patient in context, so the sign-in must supply one.</summary>
    public static bool WantsPatient(IEnumerable<string>? scopes) =>
        scopes?.Any(s => s == "launch/patient" || s.StartsWith("patient/", StringComparison.Ordinal)) == true;

    /// <summary>The "udap" scope marks a tiered flow, where an identity provider authenticates the user and a resource sign-in does not apply.</summary>
    public static bool IsTieredRequest(IEnumerable<string>? scopes) => scopes?.Contains(UdapConstants.StandardScopes.Udap, StringComparer.Ordinal) == true;

    /// <summary>No user store holds a resource, so the session holds each claim that the tokens of a resource sign-in need.</summary>
    public static IdentityServerUser CreateUser(string fhirBase, string type, string id, string? patientId)
    {
        var fhirUser = FhirUserFor(fhirBase, type, id);
        var user = new IdentityServerUser(SubjectFor(fhirBase, type, id))
        {
            DisplayName = fhirUser,
            AuthenticationMethods = { Amr },
            AdditionalClaims =
            {
                new Claim(FhirUserClaim, fhirUser),
                new Claim(BaseClaim, NormalizeBase(fhirBase)),
            },
        };

        var patient = type == "Patient" ? id : patientId;
        if (patient is not null)
        {
            user.AdditionalClaims.Add(new Claim(PatientClaim, patient));
        }

        return user;
    }

    /// <summary>
    /// For a request with no udap scope, a valid resource hint must match the type and id of the session fhirUser. A resource session also needs the base of a valid aud, and a patient claim when the request asks for a patient in context and the resource is not a Patient.
    /// A resource session must not answer a tiered request, because an identity provider must authenticate the user there.
    /// Gives the first rule that applies, or None when no rule of this class asks for a sign-in. A request with no session also gives None, because Duende asks for that sign-in itself. The caller passes a null login hint to turn off the different resource rule.
    /// </summary>
    public static NewSignInReason NewSignInReasonFor(ClaimsPrincipal? session, string? aud, string? loginHint, IEnumerable<string>? scopes)
    {
        if (session?.Identity?.IsAuthenticated != true)
        {
            return NewSignInReason.None;
        }

        var isPersona = IsPersona(session);
        if (IsTieredRequest(scopes))
        {
            return isPersona ? NewSignInReason.TieredRequest : NewSignInReason.None;
        }

        var fhirUser = session.FindFirst(FhirUserClaim)?.Value;

        if (isPersona && IsValidBase(aud) && NormalizeBase(aud) != session.FindFirst(BaseClaim)?.Value)
        {
            return NewSignInReason.OtherServer;
        }

        if (TryParseHint(loginHint, out var type, out var id)
            && fhirUser?.EndsWith($"/{type}/{id}", StringComparison.Ordinal) != true)
        {
            return NewSignInReason.OtherResource;
        }

        return isPersona
            && fhirUser?.Split('/') is not [.., "Patient", _]
            && session.FindFirst(PatientClaim) is null
            && WantsPatient(scopes)
            ? NewSignInReason.NoPatient
            : NewSignInReason.None;
    }

    /// <summary>
    /// A link signs a tester in with no click only when it names the server and the resource and the sign-in cannot replace a password session or a tiered session.
    /// A request that names an identity provider other than the local one in acr_values asks again after a local sign-in, so the link does not sign in there.
    /// Gives the first condition that does not hold, so the login page can name it, or None when the sign-in runs.
    /// </summary>
    public static AutoSignInRefusal AutoSignInRefusalFor(ClaimsPrincipal? session, string? aud, string? loginHint, string? signInParameter, IEnumerable<string>? scopes, string? identityProvider) =>
        signInParameter != SignInAuto ? AutoSignInRefusal.NotRequested
        : IsTieredRequest(scopes) ? AutoSignInRefusal.Tiered
        : !string.IsNullOrEmpty(identityProvider) && identityProvider != IdentityServerConstants.LocalIdentityProvider ? AutoSignInRefusal.IdentityProvider
        : !IsValidBase(aud) ? AutoSignInRefusal.NoBase
        : !TryParseHint(loginHint, out var type, out _) ? AutoSignInRefusal.NoResourceHint
        : session?.Identity?.IsAuthenticated == true && !IsPersona(session) ? AutoSignInRefusal.OtherSession
        : type != "Patient" && WantsPatient(scopes) ? AutoSignInRefusal.NoPatient
        : AutoSignInRefusal.None;

    /// <summary>SMART gives the patient in context only to a request that asks for it with launch/patient or a patient/ scope. This rule gives it to a resource sign-in only.</summary>
    public static string? PatientForResponse(ClaimsPrincipal? subject, IEnumerable<string>? scopes) =>
        IsPersona(subject) && WantsPatient(scopes) ? subject?.FindFirst(PatientClaim)?.Value : null;

    /// <summary>Duende puts the fhirUser identity claim in an ID token only for a client with AlwaysIncludeUserClaimsInIdToken, so a resource session supplies it when the fhirUser scope is granted.</summary>
    public static Claim? FhirUserForIdToken(ClaimsPrincipal? subject, IEnumerable<string>? scopes) =>
        IsPersona(subject) && scopes?.Contains(UdapConstants.StandardScopes.FhirUser, StringComparer.Ordinal) == true ? subject?.FindFirst(FhirUserClaim) : null;
}

/// <summary>The rule that asks for a sign-in again at the authorize step: a tiered request for a resource session, a different FHIR server, a different resource, or no patient for a request that asks for one.</summary>
public enum NewSignInReason
{
    None,
    TieredRequest,
    OtherServer,
    OtherResource,
    NoPatient,
}

/// <summary>The condition that stops the automatic sign-in. The login page shows no message for NotRequested and Tiered.</summary>
public enum AutoSignInRefusal
{
    None,
    NotRequested,
    Tiered,
    IdentityProvider,
    NoBase,
    NoResourceHint,
    OtherSession,
    NoPatient,
}
