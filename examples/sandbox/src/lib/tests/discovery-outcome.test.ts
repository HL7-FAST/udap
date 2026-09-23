import { describe, expect, test } from "bun:test";
import { UdapMetadata } from "../models";
import { SignedMetadataResult, discoveryPassed, judgeDiscovery, judgeIssuerMatchesSecurityServer } from "./discovery-outcome";

const FHIR = "https://fhir.example.org/fhir";
const SIGNED_OK: SignedMetadataResult = { result: "pass", message: "ok" };

function good(overrides: Partial<UdapMetadata> = {}): Partial<UdapMetadata> {
  return {
    udap_versions_supported: ["1"],
    udap_profiles_supported: ["udap_dcr", "udap_authn", "udap_authz"],
    grant_types_supported: ["client_credentials"],
    registration_endpoint: "https://as.example.org/connect/register",
    token_endpoint: "https://as.example.org/connect/token",
    token_endpoint_auth_methods_supported: ["private_key_jwt"],
    signed_metadata: "x.y.z",
    ...overrides,
  };
}

describe("judgeDiscovery", () => {
  test("passes a conformant document", () => {
    const checks = judgeDiscovery(good(), FHIR, SIGNED_OK);
    expect(discoveryPassed(checks)).toBe(true);
    expect(checks.some((c) => c.name === "signed_metadata" && c.result === "pass")).toBe(true);
  });

  test("fails when udap_versions_supported lacks 1", () => {
    const checks = judgeDiscovery(good({ udap_versions_supported: [] as unknown as ["1"] }), FHIR, SIGNED_OK);
    expect(checks.find((c) => c.name === "udap_versions_supported")?.result).toBe("fail");
    expect(discoveryPassed(checks)).toBe(false);
  });

  test("requires udap_authz when client_credentials is supported", () => {
    const checks = judgeDiscovery(good({ udap_profiles_supported: ["udap_dcr", "udap_authn"] }), FHIR, SIGNED_OK);
    expect(checks.find((c) => c.name === "udap_profiles_supported")?.result).toBe("fail");
  });

  test("fails a document that is only OpenID discovery", () => {
    const checks = judgeDiscovery(
      { registration_endpoint: "https://as.example.org/connect/register", token_endpoint: "https://as.example.org/connect/token" },
      FHIR,
      { result: "fail", message: "signed_metadata is absent" },
    );
    expect(discoveryPassed(checks)).toBe(false);
    expect(checks.filter((c) => c.result === "fail").length).toBeGreaterThanOrEqual(3);
  });

  test("reports the anchor check as info", () => {
    const checks = judgeDiscovery(good(), FHIR, SIGNED_OK);
    expect(checks.find((c) => c.name === "trust_anchor")?.result).toBe("info");
  });
});

describe("judgeIssuerMatchesSecurityServer", () => {
  test("passes when the registration endpoint is on the security server", () => {
    expect(judgeIssuerMatchesSecurityServer(good() as UdapMetadata, "https://as.example.org").result).toBe("pass");
  });
  test("fails when it is not", () => {
    expect(judgeIssuerMatchesSecurityServer(good() as UdapMetadata, "https://localhost:5001").result).toBe("fail");
  });
});
