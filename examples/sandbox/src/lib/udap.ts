"use server"

import jwt from 'jsonwebtoken';
import * as forge from 'node-forge';
import crypto, {  } from 'crypto';
import { P12Certificate, UdapClient, UdapClientRequest, UdapMetadata, UdapRegistration, UdapRegistrationRequest, UdapSoftwareStatement, UdapX509Header } from "./models";
import { getPrivateKey, getX509Certficate } from './cert-store';




export async function registerClient(regReq: UdapClientRequest, cert: P12Certificate): Promise<UdapClient> {

  console.log("Registering client...");
  console.time("Client registration complete");
    
  // discover the UDAP endpoint
  console.time("Loaded UDAP metadata");
  const udapJson = await discoverUdapEndpoint(regReq.fhirServer);
  // console.log('udapJson:', udapJson);
  console.timeEnd("Loaded UDAP metadata");

  // build register
  const register = await buildRegister(regReq, udapJson, cert);
  // console.log('register:', register);

  // build registration request body
  const regBody = await buildRequestBody(register, cert);
  // console.log('regBody:', regBody);

  // register client
  const regResp = await fetch(udapJson.registration_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(regBody)
  });
  const regJson = await regResp.json();

  if (!regResp.ok) {
    throw new Error(`Failed to register client: (${regResp.status}) ${regJson.error}: ${regJson.error_description}`);
  }
  console.log("Client registered:", regJson);

  console.timeEnd("Client registration complete");

  return {
    id: regJson.client_id,
    name: regJson.client_name,
    fhirServer: regReq.fhirServer,
    redirectUris: regJson.redirect_uris,
    responseTypes: regJson.response_types,
    scopes: regJson.scope.split(" ")
  };
}


async function discoverUdapEndpoint(fhirServer: string): Promise<UdapMetadata> {
  const url = fhirServer.replace(/\/$/, "") + "/.well-known/udap";
  const udapEndpoint = await fetch(url);
  const udapJson: UdapMetadata = await udapEndpoint.json();
  return udapJson;
}


async function buildRegister(regReq: UdapClientRequest, metadata: UdapMetadata, cert: P12Certificate): Promise<UdapRegistration> {

  const iat = Math.floor(new Date().getTime() / 1000);
  if (!regReq.scopes.includes("openid")) {
    regReq.scopes.push("openid");
  }
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
    response_types: (regReq.grantTypes||[]).includes("authorization_code") ? ["code"] : null,
    token_endpoint_auth_method: "private_key_jwt",
    scope: scopes
  } as UdapSoftwareStatement;

  const header: UdapX509Header = {
    alg: "RS256",
    x5c: await getX509Certficate(cert)
  };

  return {
    header: header,
    softwareStatement: softwareStatement
  };
}


async function buildRequestBody(register: UdapRegistration, cert: P12Certificate): Promise<UdapRegistrationRequest> {

  const pk = await getPrivateKey(cert);
  if (!pk) {
    throw new Error("Could not load private key.");
  }

  const pkPem = forge.pki.privateKeyToPem(pk);
  const x5c = register.header.x5c.raw.toString('base64');
  const header = { alg: 'RS256', x5c: [x5c], typ: undefined };

  const token = jwt.sign(register.softwareStatement, pkPem, { algorithm: 'RS256',  header: header });

  return {
    software_statement: token,
    udap: "1"
  };

}
