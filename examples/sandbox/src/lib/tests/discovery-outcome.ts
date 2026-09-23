import { UdapMetadata } from "../models";

export interface DiscoveryCheck {
  name: string;
  result: "pass" | "fail" | "info";
  message: string;
}

export interface SignedMetadataResult {
  result: "pass" | "fail";
  message: string;
  /** Claims of the signed JWT when its signature verified. */
  claims?: Record<string, unknown>;
}

export interface DiscoveryOutcome {
  metadata: UdapMetadata;
  checks: DiscoveryCheck[];
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function judgeDiscovery(metadata: Partial<UdapMetadata>, fhirServer: string, signed: SignedMetadataResult): DiscoveryCheck[] {
  const checks: DiscoveryCheck[] = [];

  checks.push(
    metadata.udap_versions_supported?.includes("1")
      ? { name: "udap_versions_supported", result: "pass", message: "udap_versions_supported includes \"1\", as UDAP Server Metadata requires." }
      : { name: "udap_versions_supported", result: "fail", message: "udap_versions_supported must include \"1\" for this client to proceed." },
  );

  const profiles = metadata.udap_profiles_supported ?? [];
  const grantTypes = metadata.grant_types_supported ?? [];
  const hasDcrAuthn = profiles.includes("udap_dcr") && profiles.includes("udap_authn");
  const needsAuthz = grantTypes.includes("client_credentials");
  const profilesOk = hasDcrAuthn && (!needsAuthz || profiles.includes("udap_authz"));
  checks.push(
    profilesOk
      ? { name: "udap_profiles_supported", result: "pass", message: "udap_profiles_supported includes the profiles this client's flow requires." }
      : {
          name: "udap_profiles_supported",
          result: "fail",
          message: needsAuthz && hasDcrAuthn
            ? "udap_profiles_supported must include udap_authz when grant_types_supported includes client_credentials."
            : "udap_profiles_supported must include udap_dcr and udap_authn.",
        },
  );

  checks.push(
    Array.isArray(metadata.grant_types_supported) && metadata.grant_types_supported.length > 0
      ? { name: "grant_types_supported", result: "pass", message: "grant_types_supported is a non-empty array." }
      : { name: "grant_types_supported", result: "fail", message: "grant_types_supported must be a non-empty array." },
  );

  checks.push(
    isHttpUrl(metadata.registration_endpoint)
      ? { name: "registration_endpoint", result: "pass", message: "registration_endpoint is a valid URL." }
      : { name: "registration_endpoint", result: "fail", message: "registration_endpoint must be an https or http URL." },
  );

  checks.push(
    isHttpUrl(metadata.token_endpoint)
      ? { name: "token_endpoint", result: "pass", message: "token_endpoint is a valid URL." }
      : { name: "token_endpoint", result: "fail", message: "token_endpoint must be an https or http URL." },
  );

  checks.push(
    metadata.token_endpoint_auth_methods_supported?.includes("private_key_jwt")
      ? { name: "token_endpoint_auth_methods_supported", result: "pass", message: "token_endpoint_auth_methods_supported includes private_key_jwt, as UDAP requires." }
      : { name: "token_endpoint_auth_methods_supported", result: "fail", message: "token_endpoint_auth_methods_supported must include private_key_jwt." },
  );

  checks.push({ name: "signed_metadata", result: signed.result, message: signed.message });

  if (signed.result === "pass" && signed.claims) {
    const changed =
      (typeof signed.claims.registration_endpoint === "string" && signed.claims.registration_endpoint !== metadata.registration_endpoint) ||
      (typeof signed.claims.token_endpoint === "string" && signed.claims.token_endpoint !== metadata.token_endpoint);
    if (changed) {
      checks.push({
        name: "signed_metadata_precedence",
        result: "info",
        message: "signed_metadata carries endpoint values that differ from the plain document, so the signed values are used.",
      });
    }
  }

  checks.push({
    name: "trust_anchor",
    result: "info",
    message: "The server certificate in signed_metadata is not chained to a trust anchor by this client.",
  });

  return checks;
}

export function discoveryPassed(checks: DiscoveryCheck[]): boolean {
  return !checks.some((c) => c.result === "fail");
}

export function judgeIssuerMatchesSecurityServer(metadata: UdapMetadata, securityServerUrl: string): DiscoveryCheck {
  const registration = new URL(metadata.registration_endpoint).origin;
  const security = new URL(securityServerUrl).origin;
  return registration === security
    ? { name: "issuer_matches_security_server", result: "pass", message: `registration_endpoint origin ${registration} matches the security server ${security}.` }
    : { name: "issuer_matches_security_server", result: "fail", message: `registration_endpoint origin ${registration} does not match the security server ${security}.` };
}

/** The IG says signed_metadata values take precedence over the plain document when both are present. */
export function applySignedMetadata(metadata: UdapMetadata, signed: SignedMetadataResult): UdapMetadata {
  if (signed.result !== "pass" || !signed.claims) {
    return metadata;
  }
  const claims = signed.claims;
  return {
    ...metadata,
    registration_endpoint: typeof claims.registration_endpoint === "string" ? claims.registration_endpoint : metadata.registration_endpoint,
    token_endpoint: typeof claims.token_endpoint === "string" ? claims.token_endpoint : metadata.token_endpoint,
    authorization_endpoint: typeof claims.authorization_endpoint === "string" ? claims.authorization_endpoint : metadata.authorization_endpoint,
    grant_types_supported: Array.isArray(claims.grant_types_supported) ? (claims.grant_types_supported as UdapMetadata["grant_types_supported"]) : metadata.grant_types_supported,
  };
}
