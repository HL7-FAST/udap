"use server";

import jwt, { JwtPayload } from "jsonwebtoken";
import * as forge from "node-forge";
import { TokenEndpointResponse } from "oauth4webapi";
import {
  P12Certificate,
  UdapClient,
  UdapClientRequest,
  UdapMetadata,
  UdapRegistration,
  UdapRegistrationRequest,
  UdapRegistrationResponse,
  UdapSoftwareStatement,
  UdapX509Header,
} from "./models";
import { getPrivateKey, getServerCertificate, getX509Certficate } from "./cert-store";
import { cacheAccessToken, getCachedAccessToken } from "./client-store";

export async function registerClient(
  regReq: UdapClientRequest,
  cert: P12Certificate,
): Promise<UdapClient> {
  console.log("Registering client...");
  console.time("Client registration complete");

  // discover the UDAP endpoint
  console.time("Loaded UDAP metadata");
  const udapMeta = await discoverUdapEndpoint(regReq.fhirServer);
  // console.log('udapMeta:', udapMeta);
  console.timeEnd("Loaded UDAP metadata");

  // build registration JWT (header and software statement JWT claims)
  const register = await buildRegister(regReq, udapMeta, cert);
  // console.log('register:', register);

  // build registration request body (get the signed software statement JWT)
  const regBody = await buildRequestBody(register, cert);
  // console.log('regBody:', regBody);

  // register client
  const regRes = await sendRegistrationRequest(udapMeta.registration_endpoint, regBody);
  const client: UdapClient = {
    id: regRes.client_id,
    name: regRes.client_name,
    iss: regRes.iss,
    sub: regRes.sub,
    aud: regRes.aud,
    authorizationEndpoint: udapMeta.authorization_endpoint,
    tokenEndpoint: udapMeta.token_endpoint,
    userinfoEndpoint: udapMeta.userinfo_endpoint,
    fhirServer: regReq.fhirServer,
    redirectUris: regRes.redirect_uris,
    responseTypes: regRes.response_types,
    scopes: regRes.scope?.split(" "),
    grantType: regReq.grantTypes.includes("authorization_code") ? "authorization_code" : "client_credentials",
  };

  console.timeEnd("Client registration complete");

  return client;
}

export async function discoverUdapEndpoint(baseUrl: string): Promise<UdapMetadata> {
  const url = baseUrl.replace(/\/$/, "") + "/.well-known/udap";
  const udapEndpoint = await fetch(url);
  const udapJson: UdapMetadata = await udapEndpoint.json();
  return udapJson;
}

async function buildRegister(
  regReq: UdapClientRequest,
  metadata: UdapMetadata,
  cert: P12Certificate,
): Promise<UdapRegistration> {
  const iat = Math.floor(new Date().getTime() / 1000);
  const scopes = regReq.scopes.join(" ");
  let logo_uri = regReq.logoUri;
  if (!logo_uri && regReq.grantTypes.includes("authorization_code")) {
    logo_uri = "https://build.fhir.org/icon-fhir-16.png";
  }

  const softwareStatement: UdapSoftwareStatement = {
    iss: regReq.issuer,
    sub: regReq.issuer,
    aud: metadata.registration_endpoint,
    iat: iat,
    exp: iat + 300,
    jti: crypto.randomUUID(),
    client_name: regReq.clientName,
    redirect_uris: regReq.redirectUris,
    contacts: regReq.contacts,
    logo_uri: logo_uri,
    grant_types: regReq.grantTypes,
    response_types: (regReq.grantTypes || []).includes("authorization_code") ? ["code"] : null,
    token_endpoint_auth_method: "private_key_jwt",
    scope: scopes,
  } as UdapSoftwareStatement;

  const header: UdapX509Header = {
    alg: "RS256",
    x5c: await getX509Certficate(cert),
  };

  return {
    header: header,
    softwareStatement: softwareStatement,
  };
}

async function buildRequestBody(
  register: UdapRegistration,
  cert: P12Certificate,
): Promise<UdapRegistrationRequest> {
  const token = await signJWT(register.softwareStatement, cert);

  return {
    software_statement: token,
    udap: "1",
  };
}

async function sendRegistrationRequest(
  registrationUrl: string,
  registrationBody: UdapRegistrationRequest,
): Promise<UdapRegistrationResponse> {
  const regResp = await fetch(registrationUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(registrationBody),
  });

  const regJson = await regResp.json();
  if (!regResp.ok) {
    throw new Error(
      `Failed to register client: (${regResp.status}) ${regJson.error}: ${regJson.error_description}`,
      { cause: { status: regResp.status, body: regJson } },
    );
  }

  // console.log("sendRegistrationRequest response:", regJson);
  return regJson;
}

export async function signJWT(payload: string | object, cert: P12Certificate): Promise<string> {
  const pk = await getPrivateKey(cert);
  if (!pk) {
    throw new Error("Could not load private key.");
  }

  const pkPem = forge.pki.privateKeyToPem(pk);
  const x5c = (await getX509Certficate(cert)).raw.toString("base64");
  const header = { alg: "RS256", x5c: [x5c], typ: undefined };

  const token = jwt.sign(payload, pkPem, { algorithm: "RS256", header: header });
  // console.log('Signed JWT:', token);

  return token;
}

export async function getClientAssertion(
  clientId: string,
  tokenEndpoint: string,
  cert: P12Certificate,
): Promise<string> {
  const body = {
    iss: clientId,
    sub: clientId,
    aud: tokenEndpoint,
    iat: Math.floor(new Date().getTime() / 1000),
    exp: Math.floor(new Date().getTime() / 1000) + 300,
    jti: crypto.randomUUID(),
  };

  const token = await signJWT(body, cert);
  // console.log('Client assertion:', token);

  return token;
}

async function getCachedToken(clientId: string): Promise<string | null> {
  const cachedToken = await getCachedAccessToken(clientId);
  if (cachedToken) {
    console.log(`Using cached token for client ${clientId}`);

    // Verify token is still valid
    const decoded = jwt.decode(cachedToken, { complete: true }) as jwt.Jwt | null;
    if (!decoded) {
      return null;
    }

    const exp = (decoded.payload as JwtPayload).exp;
    const now = Math.floor(new Date().getTime() / 1000);
    console.log(`Cached token exp: ${exp}, now: ${now}`);
    if (!exp || exp < now + 10) {
      console.log(`Cached token for client ${clientId} is expired or about to expire`);
      return null;
    }
    
    return cachedToken;
  }
  return null;
}


/**
 * Retrieves an access token response for the given UdapClient
 */
export async function getAccessToken(client: UdapClient, code?: string, redirectUri?: string): Promise<TokenEndpointResponse> {

  // If client_credentials flow, check for cached valid token first
  if (client.grantType === "client_credentials") {
    const cachedToken = await getCachedToken(client.id);
    if (cachedToken) {
      console.log(`Using cached token for client ${client.id}`);
      return { access_token: cachedToken, token_type: "bearer" };
    }
  }

  console.log(`Getting access token for client ${client.id} (${client.grantType})...`);

  const cert = await getServerCertificate();
  if (!cert) {
    throw new Error("No server certificate loaded");
  }

  const tokenParams = {
    grant_type: client.grantType,
    code: code || "",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: await getClientAssertion(client.id, client.tokenEndpoint, cert),
    // code_verifier: codeVerifier || "",
    udap: "1",
    redirect_uri: redirectUri || "",
  };


  const tokenResponse = await fetch(client.tokenEndpoint, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(tokenParams).toString(),
  });

  const tokenJson = await tokenResponse.json();
  if (!tokenResponse.ok) {
    throw new Error(
      `Failed to get token: (${tokenResponse.status}) ${tokenJson.error}: ${tokenJson.error_description}`,
    );
  }

  // Cache token if client_credentials flow
  if (client.grantType === "client_credentials" && tokenJson.access_token) {
    await cacheAccessToken(client.id, tokenJson.access_token);
  }

  return tokenJson;

}