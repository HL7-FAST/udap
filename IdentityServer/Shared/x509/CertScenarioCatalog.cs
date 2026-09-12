
namespace IdentityServer.Shared.x509;

/// <summary>A conformance statement quoted verbatim from its source, with the source URL and section.</summary>
public sealed record SpecReference(string Source, string Section, string Url, string Quote)
{
    /// <summary>Compact label for table cells, for example "IG §3.2.3" or "DCR §4.2".</summary>
    public string ShortLabel => Source.StartsWith("HL7", StringComparison.Ordinal)
        ? "IG §" + Section.Split(' ')[0]
        : "DCR §" + Section.Replace("Section ", "", StringComparison.Ordinal);
}

/// <summary>
/// A named certificate preset. Expected and ExpectedError record what the server was observed
/// to do during the verification pass, so the sandbox suite can assert on them.
/// </summary>
public sealed record CertScenario(
    string Key,
    string Title,
    string Summary,
    string Expected,
    string? ExpectedError,
    IReadOnlyList<SpecReference> References,
    Func<ClientCertificateOptions, ClientCertificateOptions> Shape,
    bool UntrustedIssuer = false,
    bool RevokeAfterIssue = false)
{
    public CertScenarioSummary ToSummary() => new(Key, Title, Summary, Expected, ExpectedError, References);
}

public sealed record CertScenarioSummary(string Key, string Title, string Summary, string Expected, string? ExpectedError, IReadOnlyList<SpecReference> References);

public static class CertScenarioCatalog
{
    public const string Valid = "valid";
    public const string Accepted = "accepted";
    public const string Rejected = "rejected";
    private const string UnapprovedSoftwareStatement = "unapproved_software_statement";

    private const string IgName = "HL7 FAST Security IG STU2";
    private const string Ig = "https://hl7.org/fhir/us/udap-security/STU2/";
    private const string DcrName = "UDAP Dynamic Client Registration STU1, incorporated by FAST IG §3.2.3";
    private const string Dcr = "https://www.udap.org/udap-dynamic-client-registration-stu1.html";

    /// <summary>The registration endpoint must validate the request, including the certificate chain.</summary>
    public static readonly SpecReference IgValidateRequest = new(IgName, "3.2.3 Request Body", Ig + "registration.html#request-body",
        "The Authorization Server SHALL validate the registration request as per Section 4 of UDAP Dynamic Client Registration. This includes validation of the JWT payload and signature, validation of the X.509 certificate chain, and validation of the requested application registration parameters.");

    public static readonly SpecReference IgJwtValidation = new(IgName, "7.1.6 JWT validation", Ig + "general.html#jwt-validation",
        "[...] the requirement that the JWT consumer validate that it trusts the corresponding JWT’s producer’s X.509 certificate by constructing a valid certificate chain from the JWT producer’s certificate to an anchor trusted by the JWT consumer, and by verifying that the certificates in the chain have not expired or been revoked.");

    public static readonly SpecReference DcrChainValidation = new(DcrName, "Section 4.2", Dcr,
        "The Authorization Server attempts to construct a valid certificate chain from the Client’s certificate (cert1) to an anchor certificate trusted by the Authorization Server using conventional X.509 chain building techniques and path validation, including certificate validity and revocation status checking. [...] If a trusted chain cannot be built and validated by the Authorization Server, the request is denied.");

    public static readonly SpecReference DcrChainBuilding = new(DcrName, "Section 4.2", Dcr,
        "The Client MAY submit a complete certificate chain in its request. The Authorization Server MAY use additional certificates not included by the Client to construct a chain (e.g. from its own certificate cache or discovered via the X.509 AIA mechanism). Authorization Servers SHOULD support the X.509 AIA mechanism for chain building.");

    public static readonly SpecReference IgIssMatchesSan = new(IgName, "3.1 Software Statement, iss claim", Ig + "registration.html#software-statement",
        "Issuer of the JWT -- unique identifying client URI. This SHALL match the value of a uniformResourceIdentifier entry in the Subject Alternative Name extension of the client's certificate included in the x5c JWT header and SHALL uniquely identify a single client app operator and application over time.");

    public static readonly SpecReference DcrIssMatchesSan = new(DcrName, "Section 4.3", Dcr,
        "The iss value MUST match a uriName entry in the Subject Alternative Names extension of the Client’s certificate.");


    public static readonly SpecReference IgX5cHeader = new(IgName, "7.1.3 JWT headers, x5c", Ig + "general.html#jwt-headers",
        "An array of one or more strings containing the X.509 certificate or certificate chain, where the leaf certificate corresponds to the key used to digitally sign the JWT. [...] with the leaf certificate appearing as the first (or only) element of the array.");

    /// <summary>Explains the two error codes the server returns. Shown once on the page, not per scenario.</summary>
    public static readonly SpecReference DcrErrorCodes = new(DcrName, "Section 5.2", Dcr,
        "Denials related to trust validation SHOULD use the “unapproved_software_statement” code. Denials related to invalid signatures SHOULD use the “invalid_software_statement” code.");

    public static readonly IReadOnlyList<CertScenario> All =
    [
        new(Valid, "Valid certificate",
            "A certificate issued by the server's own intermediate CA with a URI subject alternative name, a CRL distribution point, and a full chain. Every check in the referenced clause passes.",
            Accepted, null, [IgValidateRequest, DcrChainValidation], o => o),

        new("expired", "Expired certificate",
            "The certificate's NotAfter date is one day in the past. Path validation fails on certificate validity, so no trusted chain can be built and the request is denied before the software statement claims are examined.",
            Rejected, UnapprovedSoftwareStatement, [IgJwtValidation, DcrChainValidation],
            o => o with { NotBefore = DateTimeOffset.UtcNow.AddYears(-2).AddDays(-1), NotAfter = DateTimeOffset.UtcNow.AddDays(-1) }),

        new("not-yet-valid", "Certificate not yet valid",
            "The certificate's NotBefore date is one day in the future. RFC 5280 path validation checks the whole validity period, not only expiry, so the chain is rejected the same way an expired one is.",
            Rejected, UnapprovedSoftwareStatement, [DcrChainValidation, IgJwtValidation],
            o => o with { NotBefore = DateTimeOffset.UtcNow.AddDays(1), NotAfter = DateTimeOffset.UtcNow.AddYears(2) }),

        new("untrusted-root", "Untrusted root",
            "The chain is complete and well formed but ends at a root that no community on this server trusts, so no chain to a trusted anchor exists.",
            Rejected, UnapprovedSoftwareStatement, [DcrChainValidation, IgJwtValidation],
            o => o with { CrlUrl = null, AiaCertUrl = null }, UntrustedIssuer: true),

        new("revoked", "Revoked certificate",
            "A valid certificate whose serial number is added to the intermediate CA's CRL before it is returned. Revocation status checking during path validation finds the entry.",
            Rejected, UnapprovedSoftwareStatement, [IgJwtValidation, DcrChainValidation], o => o, RevokeAfterIssue: true),

        new("no-cdp", "No CRL distribution point",
            "The certificate has no CRL distribution point extension, so it does not tell a validator where its CRL is. The referenced clause requires revocation status checking but does not say what to do when the certificate points to no CRL. This server checks revocation only through CRL distribution points, treats the missing extension as nothing to check, and accepts the registration.",
            Accepted, null, [DcrChainValidation], o => o with { CrlUrl = null }),

        new("dead-cdp", "Unreachable CRL distribution point",
            "The CRL distribution point points at a URL that returns 404, so revocation status cannot be determined. This server treats unknown status as a failed path validation and denies the request.",
            Rejected, UnapprovedSoftwareStatement, [DcrChainValidation],
            o => o with { CrlUrl = o.CrlUrl?.Replace(".crl", "-missing.crl") }),

        new("missing-san", "No subject alternative name",
            "The certificate has no subject alternative name, so no URI can match the iss claim of the software statement. This server fails the iss check while validating the JWT, before trust evaluation, which is why the error code is the signature one rather than the trust one.",
            Rejected, "invalid_software_statement", [IgIssMatchesSan, DcrIssMatchesSan], o => o with { IncludeSubjectAltName = false }),

        new("missing-intermediate", "Chain without the intermediate",
            "The PKCS#12 bundle omits the intermediate certificate. The x5c header may carry only the leaf, and the server may complete the chain from its own store or AIA. This server already trusts that intermediate from its CertStore, so registration succeeds.",
            Accepted, null, [DcrChainBuilding, IgX5cHeader], o => o with { IncludeIntermediateInBundle = false }),
    ];

    public static CertScenario? Find(string key) =>
        All.FirstOrDefault(s => s.Key.Equals(key, StringComparison.OrdinalIgnoreCase));
}
