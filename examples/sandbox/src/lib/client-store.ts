"use server";

import { getServerCertificate, getX509Certficate } from "./cert-store";
import { AUTHORIZATION_CODE_CLIENT_ID, CLIENT_CREDENTIALS_CLIENT_ID } from "./constants";
import { registerClient } from "./udap-actions";
import { getDefaultFhirServer } from "./env";
import { UdapClient, UdapClientRequest } from "@/lib/models";

const clients: Map<string, UdapClient> = new Map();
const cachedTokens: Map<string, string> = new Map();
let initialized = false;

/**
 * Ensures default clients are registered (runs once)
 */
async function ensureInitialized(): Promise<void> {
  if (!initialized) {
    initialized = true;
    await registerDefaultClients();
  }
}

export async function addClient(id: string, client: UdapClient): Promise<void> {
  clients.set(id, client);
}

export async function getClient(id: string): Promise<UdapClient | undefined> {
  await ensureInitialized();
  return clients.get(id);
}

export async function getAllClients(): Promise<UdapClient[]> {
  await ensureInitialized();
  return Array.from(clients.values());
}

export async function removeClient(id: string): Promise<boolean> {
  return clients.delete(id);
}

export async function cacheAccessToken(clientId: string, token: string): Promise<void> {
  cachedTokens.set(clientId, token);
}

export async function getCachedAccessToken(clientId: string): Promise<string | undefined> {
  return cachedTokens.get(clientId);
}

/**
 * Registers default UDAP clients and adds them to the client store
 */
export async function registerDefaultClients(): Promise<UdapClient[]> {

  const cert = await getServerCertificate();
  if (!cert) {
    throw new Error("No server certificate loaded");
  }

  const x509 = await getX509Certficate(cert);
  // console.log('x509:', x509);
  if (!x509.subjectAltName) {
    throw new Error("No alt names in certificate");
  }
  const sans = x509.subjectAltName.split(", ").map(s => s.replace("URI:", "").trim());

  const defaultClients = [];

  // Register default authorization_code client

  let hostUrl = process.env.APP_URL ?? "http://localhost:3000/";
  hostUrl = hostUrl.endsWith("/") ? hostUrl : hostUrl + "/";

  let regReq: UdapClientRequest = {
    fhirServer: await getDefaultFhirServer(),
    grantTypes: ["authorization_code"],
    issuer: sans[0],
    clientName: "FAST Security Sandbox Client",
    contacts: ["mailto:tester@localhost"],
    scopes: ["openid", "fhirUser", "profile", "user/*.rs", "user/*.read"],
    redirectUris: [hostUrl + "api/auth/callback/udap"],
  };

  let client = await registerClient(regReq, cert);
  await addClient(AUTHORIZATION_CODE_CLIENT_ID, client);
  defaultClients.push(client);


  // Register default client_credentials client if another SAN is available

  if (sans.length > 1) {
    regReq = {
      fhirServer: await getDefaultFhirServer(),
      grantTypes: ["client_credentials"],
      issuer: sans[1],
      clientName: "FAST Security Sandbox Client",
      contacts: ["mailto:tester@localhost"],
      scopes: ["system/*.read", "system/*.rs"]
    };

    client = await registerClient(regReq, cert);
    await addClient(CLIENT_CREDENTIALS_CLIENT_ID, client);
    defaultClients.push(client);
  }


  console.log("Registered default UDAP clients: ", defaultClients.map(c => c.id));
  return defaultClients;
}
