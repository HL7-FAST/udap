"use server";

import { readFile } from "fs/promises";
import { X509Certificate } from "crypto";
import * as forge from "node-forge";
import { CERT_STORE_SERVER_ID } from "./constants";
import { P12Certificate } from "./models";

const certificates: Map<string, P12Certificate> = new Map();

export async function addCertificate(id: string, cert: P12Certificate): Promise<void> {
  certificates.set(id, cert);
}

export async function getServerCertificate(): Promise<P12Certificate | undefined> {
  let cert = certificates.get(CERT_STORE_SERVER_ID);
  if (!cert) {
    // attempt to load it...
    try {
      cert = await loadServerCertificate();
    } catch (e: unknown) {
      console.log("Error loading server certificate:", e);
      return undefined;
    }
  }
  return cert;
}

export async function getCertificate(id: string): Promise<P12Certificate | undefined> {
  return certificates.get(id);
}

export async function getAllCertificates(): Promise<P12Certificate[]> {
  return Array.from(certificates.values());
}

export async function removeCertificate(id: string): Promise<boolean> {
  return certificates.delete(id);
}

export async function loadServerCertificate(): Promise<P12Certificate> {
  console.log("loadServerCertificate() :: Loading server certificate...");
  const certFile = process.env.CERT_FILE;
  const certPassword = process.env.CERT_PASSWORD;

  if (!certFile || !certPassword) {
    throw new Error("CERT_FILE and CERT_PASSWORD environment variables must be set");
  }

  const isBase64 = (str: string) => {
    try {
      return btoa(atob(str)) === str;
    } catch {
      return false;
    }
  };

  let buffer: Buffer;
  if (isBase64(certFile)) {
    buffer = Buffer.from(certFile, "base64");
  } else {
    buffer = await readFile(certFile);
  }

  const cert = await parseCertificate(buffer, certPassword);
  addCertificate(CERT_STORE_SERVER_ID, cert);
  return cert;
}

export async function parseCertificate(
  buffer: Buffer<ArrayBufferLike>,
  password: string,
): Promise<P12Certificate> {
  const p12Asn1 = forge.asn1.fromDer(buffer.toString("binary"));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  return p12;
}

export async function getX509Certficate(p12Cert: P12Certificate): Promise<X509Certificate> {
  const certBags = p12Cert.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag];
  if (!certBag || certBag.length === 0) {
    throw new Error("No certificate found in the provided P12 file");
  }

  const certChain: X509Certificate[] = certBag.map((bag) => {
    const cert = bag.cert;
    if (!cert) {
      throw new Error("Certificate is undefined");
    }
    return new X509Certificate(forge.pki.certificateToPem(cert));
  });

  // console.log("getX509Certficate() :: certChain:", certChain);

  if (certChain.length === 0) {
    throw new Error("No certificates found in the provided P12 file");
  }

  return certChain[certChain.length - 1];
}

export async function getPrivateKey(
  p12Cert: P12Certificate,
): Promise<forge.pki.PrivateKey | undefined> {
  const pkBags = p12Cert.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const pkBag = pkBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  let pk: forge.pki.PrivateKey | undefined;
  if (pkBag && pkBag.length > 0) {
    pk = pkBag[0].key;
  }

  return pk;
}
