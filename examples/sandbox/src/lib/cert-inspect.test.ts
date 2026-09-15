import { describe, expect, test } from "bun:test";
import * as forge from "node-forge";
import { describeCertificate } from "./cert-inspect";

const PASSWORD = "udap-test";

// 1024-bit keys keep pure-JS key generation quick. Key strength plays no part in these checks.
const issuerKeys = forge.pki.rsa.generateKeyPair(1024);
const leafKeys = forge.pki.rsa.generateKeyPair(1024);

function makeCert(subjectCn: string, issuerCn: string, publicKey: forge.pki.rsa.PublicKey, signingKey: forge.pki.rsa.PrivateKey) {
  const cert = forge.pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  cert.setSubject([{ name: "commonName", value: subjectCn }]);
  cert.setIssuer([{ name: "commonName", value: issuerCn }]);
  cert.sign(signingKey, forge.md.sha256.create());
  return cert;
}

/** Puts the leaf last, matching the server's generator, which leafCertificate relies on. */
function bundle(certs: forge.pki.Certificate[]): forge.pkcs12.Pkcs12Pfx {
  return forge.pkcs12.pkcs12FromAsn1(forge.pkcs12.toPkcs12Asn1(leafKeys.privateKey, certs, PASSWORD), PASSWORD);
}

function flipLastSignatureBit(cert: forge.pki.Certificate) {
  const signature = cert.signature as string;
  const last = signature.charCodeAt(signature.length - 1) ^ 0x01;
  cert.signature = signature.slice(0, -1) + String.fromCharCode(last);
}

describe("describeCertificate issuer signature", () => {
  const issuer = makeCert("Issuer", "Issuer", issuerKeys.publicKey, issuerKeys.privateKey);

  test("verifies on a sound bundle", async () => {
    const leaf = makeCert("Leaf", "Issuer", leafKeys.publicKey, issuerKeys.privateKey);
    const facts = await describeCertificate(bundle([issuer, leaf]));
    expect(facts.subject).toBe("CN=Leaf");
    expect(facts.issuerInBundle).toBe(true);
    expect(facts.issuerSignatureValid).toBe(true);
  });

  test("is false, not null, on a tampered signature", async () => {
    const leaf = makeCert("Leaf", "Issuer", leafKeys.publicKey, issuerKeys.privateKey);
    flipLastSignatureBit(leaf);
    const facts = await describeCertificate(bundle([issuer, leaf]));
    expect(facts.issuerInBundle).toBe(true);
    expect(facts.issuerSignatureValid).toBe(false);
  });

  test("is null when the issuer is not in the bundle", async () => {
    const leaf = makeCert("Leaf", "Issuer", leafKeys.publicKey, issuerKeys.privateKey);
    const facts = await describeCertificate(bundle([leaf]));
    expect(facts.issuerInBundle).toBe(false);
    expect(facts.issuerSignatureValid).toBeNull();
  });
});
