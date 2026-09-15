import { describe, expect, test } from "bun:test";
import { CertificateFacts, judgeCertificateShape } from "./cert-facts";

const NOW = new Date("2026-09-09T00:00:00Z");
const CRL_URL = "http://localhost:5000/certs/LocalCA/crl/LocalSubCA.crl";

function validFacts(overrides: Partial<CertificateFacts> = {}): CertificateFacts {
  const notBefore = new Date(NOW);
  notBefore.setUTCFullYear(notBefore.getUTCFullYear() - 1);
  const notAfter = new Date(NOW);
  notAfter.setUTCFullYear(notAfter.getUTCFullYear() + 1);
  return {
    subject: "CN=certificate-test, O=FAST Security",
    issuer: "CN=LocalSubCA, O=FAST Security",
    notBefore: notBefore.toISOString(),
    notAfter: notAfter.toISOString(),
    subjectAltNames: ["http://localhost:3001/tests/certificates/valid"],
    crlUrls: [CRL_URL],
    crlStatus: { [CRL_URL]: 200 },
    keyUsage: ["digitalSignature", "keyEncipherment"],
    bundleSize: 3,
    hasCrlDistributionPoints: true,
    hasKeyUsage: true,
    issuerInBundle: true,
    issuerSignatureValid: true,
    ...overrides,
  };
}

describe("judgeCertificateShape", () => {
  test("valid passes on a sound certificate", () => {
    expect(judgeCertificateShape("valid", validFacts(), NOW).result).toBe("pass");
  });

  test("valid fails when the intermediate is missing", () => {
    expect(judgeCertificateShape("valid", validFacts({ bundleSize: 2 }), NOW).result).toBe("fail");
  });

  test("valid fails when the issuer is not in the bundle", () => {
    expect(judgeCertificateShape("valid", validFacts({ issuerInBundle: false }), NOW).result).toBe("fail");
  });

  test("valid fails when the issuer's signature does not verify", () => {
    expect(judgeCertificateShape("valid", validFacts({ issuerSignatureValid: false }), NOW).result).toBe("fail");
  });

  test("tampered passes when the issuer's signature does not verify", () => {
    expect(judgeCertificateShape("tampered", validFacts({ issuerSignatureValid: false }), NOW).result).toBe("pass");
  });

  test("tampered fails on the valid fixture", () => {
    expect(judgeCertificateShape("tampered", validFacts(), NOW).result).toBe("fail");
  });

  test("tampered warns when the signature could not be checked", () => {
    expect(judgeCertificateShape("tampered", validFacts({ issuerSignatureValid: null }), NOW).result).toBe("warn");
  });

  test("expired passes when notAfter is yesterday", () => {
    const notAfter = new Date(NOW);
    notAfter.setUTCDate(notAfter.getUTCDate() - 1);
    expect(judgeCertificateShape("expired", validFacts({ notAfter: notAfter.toISOString() }), NOW).result).toBe("pass");
  });

  test("expired fails on the valid fixture", () => {
    expect(judgeCertificateShape("expired", validFacts(), NOW).result).toBe("fail");
  });

  test("not-yet-valid passes when notBefore is tomorrow", () => {
    const notBefore = new Date(NOW);
    notBefore.setUTCDate(notBefore.getUTCDate() + 1);
    expect(judgeCertificateShape("not-yet-valid", validFacts({ notBefore: notBefore.toISOString() }), NOW).result).toBe("pass");
  });

  test("not-yet-valid fails on the valid fixture", () => {
    expect(judgeCertificateShape("not-yet-valid", validFacts(), NOW).result).toBe("fail");
  });

  test("untrusted-root passes when the issuer is the throwaway CA", () => {
    expect(
      judgeCertificateShape("untrusted-root", validFacts({ issuer: "CN=x Intermediate, O=Untrusted" }), NOW).result,
    ).toBe("pass");
  });

  test("untrusted-root fails on the valid fixture", () => {
    expect(judgeCertificateShape("untrusted-root", validFacts(), NOW).result).toBe("fail");
  });

  test("revoked always returns info", () => {
    expect(judgeCertificateShape("revoked", validFacts(), NOW).result).toBe("info");
  });

  test("no-cdp passes when the extension is absent", () => {
    expect(
      judgeCertificateShape("no-cdp", validFacts({ crlUrls: [], crlStatus: {}, hasCrlDistributionPoints: false }), NOW).result,
    ).toBe("pass");
  });

  test("no-cdp fails on the valid fixture", () => {
    expect(judgeCertificateShape("no-cdp", validFacts(), NOW).result).toBe("fail");
  });

  test("dead-cdp passes when the CRL URL returns 404", () => {
    expect(
      judgeCertificateShape("dead-cdp", validFacts({ crlStatus: { [CRL_URL]: 404 } }), NOW).result,
    ).toBe("pass");
  });

  test("dead-cdp fails when the CRL URL returns 200", () => {
    expect(judgeCertificateShape("dead-cdp", validFacts(), NOW).result).toBe("fail");
  });

  test("dead-cdp fails when there is no CRL URL at all", () => {
    expect(
      judgeCertificateShape(
        "dead-cdp",
        validFacts({ crlUrls: [], crlStatus: {}, hasCrlDistributionPoints: false }),
        NOW,
      ).result,
    ).toBe("fail");
  });

  test("dead-cdp warns when the CRL URL is unreachable", () => {
    const judgement = judgeCertificateShape("dead-cdp", validFacts({ crlStatus: { [CRL_URL]: "unreachable" } }), NOW);
    expect(judgement.result).toBe("warn");
    expect(judgement.message).toContain(CRL_URL);
  });

  test("dead-cdp warns when the extension carries no HTTP URL to probe", () => {
    const judgement = judgeCertificateShape("dead-cdp", validFacts({ crlUrls: [], crlStatus: {} }), NOW);
    expect(judgement.result).toBe("warn");
    expect(judgement.message).toContain("no HTTP URL to probe");
  });

  test("missing-san passes when there is no SAN", () => {
    expect(judgeCertificateShape("missing-san", validFacts({ subjectAltNames: [] }), NOW).result).toBe("pass");
  });

  test("missing-san fails on the valid fixture", () => {
    expect(judgeCertificateShape("missing-san", validFacts(), NOW).result).toBe("fail");
  });

  test("missing-intermediate passes when the bundle has two certs and the issuer is not one of them", () => {
    expect(
      judgeCertificateShape("missing-intermediate", validFacts({ bundleSize: 2, issuerInBundle: false }), NOW).result,
    ).toBe("pass");
  });

  test("missing-intermediate fails on the valid fixture", () => {
    expect(judgeCertificateShape("missing-intermediate", validFacts(), NOW).result).toBe("fail");
  });

  test("missing-intermediate fails when the bundle has two certs but the issuer is present", () => {
    const judgement = judgeCertificateShape(
      "missing-intermediate",
      validFacts({ bundleSize: 2, issuerInBundle: true }),
      NOW,
    );
    expect(judgement.result).toBe("fail");
    expect(judgement.message).toContain("2");
  });

  test("an unknown scenario key returns info", () => {
    expect(judgeCertificateShape("no-such-scenario", validFacts(), NOW).result).toBe("info");
  });
});
