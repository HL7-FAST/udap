import { TrustJudgement } from "./trust-outcome";

/** What the sandbox observed in the generated PKCS#12 bundle. Dates are ISO strings so the facts survive JSON. */
export interface CertificateFacts {
  subject: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  subjectAltNames: string[];
  crlUrls: string[];
  /** HTTP status per CRL URL, or "unreachable" when the fetch threw. */
  crlStatus: Record<string, number | "unreachable">;
  keyUsage: string[];
  bundleSize: number;
  hasCrlDistributionPoints: boolean;
  hasKeyUsage: boolean;
  /** True when another certificate in the bundle has a subject equal to the leaf's issuer. */
  issuerInBundle: boolean;
  /** Whether the issuer's signature on the leaf verifies. Null when the issuer is not in the bundle or the algorithm is unsupported. */
  issuerSignatureValid: boolean | null;
}

export interface ShapeJudgement extends Omit<TrustJudgement, "result"> {
  result: "pass" | "fail" | "info" | "warn";
}

/** The server's throwaway CA names its root and intermediate with this organization. */
const UNTRUSTED_ORG = "O=Untrusted";

function check(ok: boolean, pass: string, fail: string): ShapeJudgement {
  return ok ? { result: "pass", message: pass } : { result: "fail", message: fail };
}

/** Judges whether the certificate carries the defect (or the soundness) its scenario claims. */
export function judgeCertificateShape(scenarioKey: string, facts: CertificateFacts, now: Date): ShapeJudgement {
  const notBefore = new Date(facts.notBefore);
  const notAfter = new Date(facts.notAfter);
  const hasDigitalSignature = facts.keyUsage.includes("digitalSignature");
  const untrusted = facts.issuer.includes(UNTRUSTED_ORG);

  switch (scenarioKey) {
    case "valid":
      return check(
        notBefore <= now && now <= notAfter && facts.subjectAltNames.length > 0 && facts.crlUrls.length > 0 &&
          hasDigitalSignature && facts.bundleSize === 3 && !untrusted && facts.issuerInBundle && facts.issuerSignatureValid === true,
        "Certificate is current, carries a SAN, a CRL distribution point, and digitalSignature, its issuer's signature verifies, and the bundle holds the leaf, its issuing intermediate, and a third certificate.",
        "Certificate does not look like a sound client certificate; see the facts above.",
      );
    case "expired":
      return check(notAfter < now, `NotAfter ${facts.notAfter} is in the past.`, `NotAfter ${facts.notAfter} is not in the past.`);
    case "not-yet-valid":
      return check(notBefore > now, `NotBefore ${facts.notBefore} is in the future.`, `NotBefore ${facts.notBefore} is not in the future.`);
    case "untrusted-root":
      return check(untrusted, `Issuer is the server's throwaway CA: ${facts.issuer}.`, `Issuer is not the throwaway CA: ${facts.issuer}.`);
    case "tampered":
      if (facts.issuerSignatureValid === null) {
        return { result: "warn", message: "The issuer's signature could not be checked from the bundle, so the tampering is unverified." };
      }
      return check(!facts.issuerSignatureValid, "The issuer's signature on the certificate does not verify.", "The issuer's signature on the certificate verifies.");
    case "revoked":
      return {
        result: "info",
        message: "Certificate inspection cannot show revocation. Check the issuer's CRL or the server log for this certificate.",
      };
    case "no-cdp":
      return check(
        !facts.hasCrlDistributionPoints,
        "No CRL distribution point extension.",
        `CRL distribution point extension present${facts.crlUrls.length > 0 ? `: ${facts.crlUrls.join(", ")}` : ""}.`,
      );
    case "dead-cdp": {
      if (facts.hasCrlDistributionPoints && facts.crlUrls.length === 0) {
        return {
          result: "warn",
          message: "The CRL distribution point extension carries no HTTP URL to probe, so the dead CRL distribution point is unverified.",
        };
      }
      const unreachable = facts.crlUrls.filter((u) => facts.crlStatus[u] === "unreachable" || facts.crlStatus[u] === undefined);
      if (unreachable.length > 0) {
        return {
          result: "warn",
          message: `Could not reach ${unreachable.join(", ")} from the sandbox, so the dead CRL distribution point is unverified.`,
        };
      }
      const statuses = facts.crlUrls.map((u) => `${u} -> ${facts.crlStatus[u]}`).join(", ");
      return check(
        facts.hasCrlDistributionPoints && facts.crlUrls.every((u) => facts.crlStatus[u] === 404),
        `CRL distribution point does not serve a CRL: ${statuses}.`,
        `Expected a CRL distribution point that fails to load: ${statuses || "(none)"}.`,
      );
    }
    case "missing-san":
      return check(facts.subjectAltNames.length === 0, "No Subject Alternative Name extension.", `SAN present: ${facts.subjectAltNames.join(", ")}.`);
    case "missing-intermediate":
      return check(
        facts.bundleSize === 2 && !facts.issuerInBundle,
        "Bundle holds two certificates and the leaf's issuer is not one of them.",
        `Bundle holds ${facts.bundleSize} certificates${facts.issuerInBundle ? " and the leaf's issuer is present" : ""}.`,
      );
    default:
      return { result: "info", message: `No certificate shape check exists for scenario \`${scenarioKey}\`.` };
  }
}
