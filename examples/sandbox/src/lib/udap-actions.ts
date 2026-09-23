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
import { tokenRequestScopes } from "./utils";
import { UdapTransport, udapFetch } from "./udap-transport";

export async function registerClient(
  regReq: UdapClientRequest,
  cert: P12Certificate,
  transport?: UdapTransport,
  metadata?: UdapMetadata,
): Promise<UdapClient> {
  console.log("Registering client...");
  console.time("Client registration complete");
  try {
    return await registerClientTimed(regReq, cert, transport, metadata);
  } finally {
    // A rejected registration throws, so the timer ends here.
    console.timeEnd("Client registration complete");
  }
}

async function registerClientTimed(
  regReq: UdapClientRequest,
  cert: P12Certificate,
  transport?: UdapTransport,
  metadata?: UdapMetadata,
): Promise<UdapClient> {
  // discover the UDAP endpoint, unless the caller already discovered it
  let udapMeta: UdapMetadata;
  if (metadata) {
    udapMeta = metadata;
  } else {
    console.time("Loaded UDAP metadata");
    try {
      udapMeta = await discoverUdapEndpoint(regReq.fhirServer, transport);
    } finally {
      console.timeEnd("Loaded UDAP metadata");
    }
  }

  // build registration JWT (header and software statement JWT claims)
  const register = await buildRegister(regReq, udapMeta, cert);
  // console.log('register:', register);

  // build registration request body (get the signed software statement JWT)
  const regBody = await buildRequestBody(register, cert);
  // console.log('regBody:', regBody);

  // register client
  const regRes = await sendRegistrationRequest(udapMeta.registration_endpoint, regBody, transport);
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
    requestedScopes: regReq.scopes,
    grantType: regReq.grantTypes.includes("authorization_code") ? "authorization_code" : "client_credentials",
  };

  return client;
}

export async function discoverUdapEndpoint(baseUrl: string, transport?: UdapTransport): Promise<UdapMetadata> {
  const url = baseUrl.replace(/\/$/, "") + "/.well-known/udap";
  const udapEndpoint = await udapFetch(url, { headers: { Accept: "application/json" } }, transport);
  if (!udapEndpoint.ok) {
    throw new Error(`UDAP well-known endpoint ${url} returned HTTP ${udapEndpoint.status}`);
  }
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
  transport?: UdapTransport,
): Promise<UdapRegistrationResponse> {
  const regResp = await udapFetch(registrationUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(registrationBody),
  }, transport);

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
 * Retrieves an access token response for the given UdapClient. When `cert` is given, it signs the
 * client assertion instead of the sandbox's own server certificate, and the token is neither read
 * from nor written to the client_credentials cache, since the cert is the caller's identity, not
 * the sandbox's.
 */
export async function getAccessToken(
  client: UdapClient,
  code?: string,
  redirectUri?: string,
  codeVerifier?: string,
  cert?: P12Certificate,
  transport?: UdapTransport,
): Promise<TokenEndpointResponse> {

  // If client_credentials flow, check for cached valid token first
  if (!cert && client.grantType === "client_credentials") {
    const cachedToken = await getCachedToken(client.id);
    if (cachedToken) {
      console.log(`Using cached token for client ${client.id}`);
      return { access_token: cachedToken, token_type: "bearer" };
    }
  }

  console.log(`Getting access token for client ${client.id} (${client.grantType})...`);

  const signingCert = cert ?? (await getServerCertificate());
  if (!signingCert) {
    throw new Error("No server certificate loaded");
  }

  const tokenParams: Record<string, string> = {
    grant_type: client.grantType,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: await getClientAssertion(client.id, client.tokenEndpoint, signingCert),
    udap: "1",
  };

  if (client.grantType === "authorization_code") {
    tokenParams.code = code || "";
    tokenParams.redirect_uri = redirectUri || "";
    if (codeVerifier) {
      tokenParams.code_verifier = codeVerifier;
    }
  } else {
    tokenParams.scope = tokenRequestScopes(client).join(" ");
  }


  const tokenResponse = await udapFetch(client.tokenEndpoint, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(tokenParams).toString(),
  }, transport);

  const tokenJson = await tokenResponse.json();
  if (!tokenResponse.ok) {
    throw new Error(
      `Failed to get token: (${tokenResponse.status}) ${tokenJson.error}: ${tokenJson.error_description}`,
      { cause: { status: tokenResponse.status, body: tokenJson } },
    );
  }

  // Cache token if client_credentials flow with the sandbox's own identity
  if (!cert && client.grantType === "client_credentials" && tokenJson.access_token) {
    await cacheAccessToken(client.id, tokenJson.access_token);
  }

  return tokenJson;

}