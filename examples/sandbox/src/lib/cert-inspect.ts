import * as forge from "node-forge";
import { CertificateFacts } from "./tests/cert-facts";

// Fixed as a demo convention so the page can show it next to the download button.
export const BUNDLE_PASSWORD = "udap-test";

const KEY_USAGE_NAMES = [
  "digitalSignature",
  "nonRepudiation",
  "keyEncipherment",
  "dataEncipherment",
  "keyAgreement",
  "keyCertSign",
  "cRLSign",
  "encipherOnly",
  "decipherOnly",
] as const;

/** True for a context-specific ASN.1 node with the given tag. Checks class and tag only. */
function isContextTag(node: forge.asn1.Asn1, tag: number): boolean {
  return node.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && node.type === tag;
}

/**
 * Walks the decoded CRLDistributionPoints value (RFC 5280 SS4.2.1.13) down its one legal path to a URI:
 * SEQUENCE OF DistributionPoint -> DistributionPoint.distributionPoint [0] -> DistributionPointName.fullName [0]
 * -> GeneralName.uniformResourceIdentifier [6]. Ignores cRLIssuer and any other GeneralName choice.
 */
function extractCrlDistributionPointUris(distributionPoints: forge.asn1.Asn1): string[] {
  const uris: string[] = [];
  for (const distributionPoint of Array.isArray(distributionPoints.value) ? distributionPoints.value : []) {
    const fields = Array.isArray(distributionPoint.value) ? distributionPoint.value : [];
    const distributionPointName = fields.find((f) => isContextTag(f, 0));
    const fullName = Array.isArray(distributionPointName?.value)
      ? distributionPointName.value.find((f) => isContextTag(f, 0))
      : undefined;
    for (const generalName of Array.isArray(fullName?.value) ? fullName.value : []) {
      if (isContextTag(generalName, 6) && typeof generalName.value === "string") {
        uris.push(generalName.value);
      }
    }
  }
  return uris;
}

function attributeString(entity: forge.pki.Certificate["subject"]): string {
  return entity.attributes.map((a) => `${a.shortName ?? a.name}=${a.value}`).join(", ");
}

/** Returns the leaf certificate from a generated PKCS#12 bundle (the last cert bag, per the server's generator). */
export function leafCertificate(cert: forge.pkcs12.Pkcs12Pfx): forge.pki.Certificate {
  const certBags = cert.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
  if (!certBags || certBags.length === 0) {
    throw new Error("No certificate found in the generated bundle");
  }
  const certs = certBags.map((bag) => bag.cert).filter((c): c is forge.pki.Certificate => c !== undefined);
  if (certs.length === 0) {
    throw new Error("Leaf certificate bag has no certificate");
  }
  return certs[certs.length - 1];
}

/** Leaf certificate serial number as upper-case hex, no separators. node-forge already exposes it as hex. */
export function leafSerialHex(cert: forge.pkcs12.Pkcs12Pfx): string {
  return leafCertificate(cert).serialNumber.toUpperCase();
}

/** Extracts the facts cert-facts.ts judges from the leaf certificate in the generated PKCS#12 bundle. */
export async function describeCertificate(cert: forge.pkcs12.Pkcs12Pfx): Promise<CertificateFacts> {
  const certBags = cert.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
  const bundleSize = certBags?.length ?? 0;
  const certs = (certBags ?? []).map((bag) => bag.cert).filter((c): c is forge.pki.Certificate => c !== undefined);
  const leaf = leafCertificate(cert);

  const subject = attributeString(leaf.subject);
  const issuer = attributeString(leaf.issuer);
  // node-forge sets .hash from the encoded name when it parses a certificate. This is exact encoded-name
  // matching, which fits the server's generator. It is not general X.509 name equivalence.
  const issuerInBundle = certs.slice(0, certs.length - 1).some((c) => c.subject.hash === leaf.issuer.hash);

  const sanExtension = leaf.getExtension("subjectAltName") as { altNames?: { value: string }[] } | undefined;
  const subjectAltNames = sanExtension?.altNames?.map((a) => a.value) ?? [];

  const cdpExtension = leaf.getExtension("cRLDistributionPoints") as { value?: string } | undefined;
  // forge.getExtension() returns null (not undefined) when the extension is absent.
  const hasCrlDistributionPoints = cdpExtension != null;
  const crlUrls = cdpExtension?.value
    ? [...new Set(extractCrlDistributionPointUris(forge.asn1.fromDer(cdpExtension.value)))]
    : [];
  // Fetching every URL is unbounded work against attacker-controlled cert data. Cap the probe, not the fact.
  // A URL beyond the cap gets no crlStatus entry, which the judge already reports as unverified.
  const urlsToProbe = crlUrls.slice(0, 5);

  const keyUsageExtension = leaf.getExtension("keyUsage") as Record<string, boolean> | undefined;
  const hasKeyUsage = keyUsageExtension != null;
  const keyUsage = keyUsageExtension
    ? KEY_USAGE_NAMES.filter((name) => keyUsageExtension[name] === true)
    : [];

  const crlStatusEntries = await Promise.all(
    urlsToProbe.map(async (url): Promise<[string, number | "unreachable"]> => {
      try {
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
        try {
          await response.body?.cancel();
        } catch {
          // Draining the body is a courtesy to the connection pool, not load-bearing.
        }
        return [url, response.status];
      } catch {
        return [url, "unreachable"];
      }
    }),
  );

  return {
    subject,
    issuer,
    notBefore: leaf.validity.notBefore.toISOString(),
    notAfter: leaf.validity.notAfter.toISOString(),
    subjectAltNames,
    crlUrls,
    crlStatus: Object.fromEntries(crlStatusEntries),
    keyUsage,
    bundleSize,
    hasCrlDistributionPoints,
    hasKeyUsage,
    issuerInBundle,
  };
}
