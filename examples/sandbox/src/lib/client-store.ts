"use server"

import { getServerCertificate, getX509Certficate } from './cert-store';
import { CLIENT_STORE_DEFAULT_ID } from './constants';
import { registerClient } from './udap-actions';
import { getDefaultFhirServer } from './env';
import { UdapClient, UdapClientRequest } from '@/lib/models';


const clients: Map<string, UdapClient> = new Map();

export async function addClient(id: string, client: UdapClient): Promise<void> {
  clients.set(id, client);
}

export async function getClient(id: string): Promise<UdapClient | undefined> {
  return clients.get(id);
}

export async function getAllClients(): Promise<UdapClient[]> {
  return Array.from(clients.values());
}

export async function removeClient(id: string): Promise<boolean> {
  return clients.delete(id);
}


export async function getDefaultClient(): Promise<UdapClient> {

  let client = await getClient(CLIENT_STORE_DEFAULT_ID);
  if (client) {
    return client;
  }

  // register default client if it doesn't exist

  const cert = await getServerCertificate();
  if (!cert) {
    throw new Error("No server certificate loaded");
  }

  const x509 = await getX509Certficate(cert);
  // console.log('x509:', x509);
  if (!x509.subjectAltName) {
    throw new Error("No alt names in certificate");
  }

  // const headerList = await headers();
  // const host = headerList.get('x-forwarded-host') ?? "localhost:3000";
  // const proto = headerList.get('x-forwarded-proto') ?? "http";
  // const hostUrl = `${proto}://${host.endsWith('/') ? host : host + '/'}`;
  let hostUrl = process.env.APP_URL ?? "http://localhost:3000/";
  hostUrl = hostUrl.endsWith('/') ? hostUrl : hostUrl + '/';

  const regReq: UdapClientRequest = {
    fhirServer: await getDefaultFhirServer(),
    grantTypes: ["authorization_code", "refresh_token"],
    issuer: hostUrl,
    clientName: "FAST Security Sandbox Client",
    contacts: ["mailto:tester@localhost"],
    scopes: ["openid", "fhirUser", "profile", "user/*.rs", "user/*.read"],
    // redirectUris: [hostUrl],
    redirectUris: [hostUrl + "api/auth/callback/udap"],
    // redirectUris: [hostUrl + "api/auth/udap"], // custom callback route for now
  };

  client = await registerClient(regReq, cert);
  await addClient(CLIENT_STORE_DEFAULT_ID, client);
  return client;
}