import { describe, expect, test } from "bun:test";
import jwt from "jsonwebtoken";
import * as forge from "node-forge";
import { verifySignedMetadata } from "./signed-metadata";

const FHIR = "https://fhir.example.org/fhir";
const keys = forge.pki.rsa.generateKeyPair(1024);

function makeCert() {
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  cert.setSubject([{ name: "commonName", value: "fhir.example.org" }]);
  cert.setIssuer([{ name: "commonName", value: "fhir.example.org" }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return cert;
}

function sign(claims: object, alg: "RS256" | "RS384" = "RS256") {
  const cert = makeCert();
  const x5c = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), "binary").toString("base64");
  // allowInsecureKeySizes lets the test keep 1024-bit keys, matching cert-inspect.test.ts, since key strength plays no part in these checks.
  return jwt.sign(claims, forge.pki.privateKeyToPem(keys.privateKey), { algorithm: alg, header: { alg, x5c: [x5c] }, allowInsecureKeySizes: true });
}

const now = Math.floor(Date.now() / 1000);
const claims = { iss: FHIR, sub: FHIR, iat: now, exp: now + 300, jti: "n1", registration_endpoint: "https://as.example.org/connect/register" };

describe("verifySignedMetadata", () => {
  test("passes a JWT signed by its x5c leaf with iss equal to the FHIR server", () => {
    const r = verifySignedMetadata(sign(claims), FHIR);
    expect(r.result).toBe("pass");
    expect(r.claims?.registration_endpoint).toBe("https://as.example.org/connect/register");
  });
  test("fails when absent", () => {
    expect(verifySignedMetadata(undefined, FHIR).result).toBe("fail");
  });
  test("fails on a wrong iss", () => {
    expect(verifySignedMetadata(sign({ ...claims, iss: "https://other.example.org" }), FHIR).result).toBe("fail");
  });
  test("fails when expired", () => {
    expect(verifySignedMetadata(sign({ ...claims, exp: now - 10 }), FHIR).result).toBe("fail");
  });
  test("fails on an algorithm other than RS256", () => {
    expect(verifySignedMetadata(sign(claims, "RS384"), FHIR).result).toBe("fail");
  });
  test("fails on a tampered signature", () => {
    const token = sign(claims);
    const flipped = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(verifySignedMetadata(flipped, FHIR).result).toBe("fail");
  });
});
