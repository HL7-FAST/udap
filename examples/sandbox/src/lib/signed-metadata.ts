import { X509Certificate } from "node:crypto";
import jwt from "jsonwebtoken";
import { SignedMetadataResult } from "./tests/discovery-outcome";

/**
 * Checks signed_metadata as UDAP Server Metadata section 3 requires of a client: RS256, signature
 * by the x5c leaf, iss equal to the server base URL, not expired. Chain trust to an anchor is
 * left to the caller because the sandbox holds no anchor of its own.
 */
export function verifySignedMetadata(signedMetadata: string | undefined, fhirServer: string, now: Date = new Date()): SignedMetadataResult {
  if (!signedMetadata) {
    return { result: "fail", message: "signed_metadata is absent." };
  }
  const decoded = jwt.decode(signedMetadata, { complete: true });
  if (!decoded || typeof decoded.payload !== "object") {
    return { result: "fail", message: "signed_metadata is not a JWT." };
  }
  if (decoded.header.alg !== "RS256") {
    return { result: "fail", message: `signed_metadata uses ${decoded.header.alg}, the IG requires RS256.` };
  }
  const x5c = decoded.header.x5c;
  if (!Array.isArray(x5c) || x5c.length === 0) {
    return { result: "fail", message: "signed_metadata has no x5c header." };
  }
  let claims: Record<string, unknown>;
  try {
    const leaf = new X509Certificate(Buffer.from(x5c[0], "base64"));
    claims = jwt.verify(signedMetadata, leaf.publicKey.export({ type: "spki", format: "pem" }), {
      algorithms: ["RS256"],
      clockTimestamp: Math.floor(now.getTime() / 1000),
    }) as Record<string, unknown>;
  } catch (e) {
    return { result: "fail", message: `signed_metadata does not verify: ${e instanceof Error ? e.message : "unknown error"}` };
  }
  const expected = fhirServer.replace(/\/$/, "");
  if (typeof claims.iss !== "string" || claims.iss.replace(/\/$/, "") !== expected) {
    return { result: "fail", message: `signed_metadata iss is ${String(claims.iss)}, expected ${expected}.` };
  }
  if (typeof claims.exp !== "number") {
    return { result: "fail", message: "signed_metadata has no exp claim." };
  }
  return { result: "pass", message: "signed_metadata verifies with its x5c certificate and names this server as iss.", claims };
}
