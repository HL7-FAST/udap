import { NextRequest, NextResponse } from "next/server";
import { readPatientForOutcome } from "@/lib/access-outcome";
import { addCertificate, getCertificate, parseCertificate } from "@/lib/cert-store";
import { BUNDLE_PASSWORD, describeCertificate, leafSerialHex } from "@/lib/cert-inspect";
import { addClient, addMetadata, getMetadata, getStoredClient } from "@/lib/client-store";
import { UdapClient, UdapClientRequest, UdapMetadata } from "@/lib/models";
import { registerForOutcome } from "@/lib/register-outcome";
import { errorResponse, normalizeServerUrl } from "@/lib/route-helpers";
import { AuthorizationCodeGrant, requestTokenForOutcome } from "@/lib/token-outcome";
import { applySignedMetadata, discoveryPassed, judgeDiscovery, judgeIssuerMatchesSecurityServer } from "@/lib/tests/discovery-outcome";
import { verifySignedMetadata } from "@/lib/signed-metadata";
import { discoverUdapEndpoint } from "@/lib/udap-actions";
import { UdapTransport } from "@/lib/udap-transport";

export interface WalkthroughStepRequest {
  serverUrl: string;
  fhirServer: string;
  proxy?: { resourceServer?: string; authorizationServer?: string };
  /** Sent on every standards request (discover, register, token, access), with or without a proxy. */
  headers?: Array<{ name: string; value: string }>;
  action: "issue" | "discover" | "register" | "token" | "access";
  altName?: string;
  certId?: string;
  clientId?: string;
  scenario?: string;
  accessToken?: string;
  /** Register and verify: which grant to request. Defaults to client_credentials. */
  grantType?: "client_credentials" | "authorization_code";
  /** Token, authorization_code only. */
  code?: string;
  redirectUri?: string;
  codeVerifier?: string;
  /** Register and verify. Defaults per grant type when absent. */
  scopes?: string[];
}

function badRequest(message: string): Response {
  return NextResponse.json({ status: "error", message }, { status: 400 });
}

export async function POST(request: NextRequest): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }
  if (!rawBody || typeof rawBody !== "object") {
    return badRequest("Request body must be an object");
  }
  const body = rawBody as WalkthroughStepRequest;
  const serverUrl = normalizeServerUrl(body.serverUrl);
  if (!serverUrl) {
    return badRequest("serverUrl must be a valid http or https URL");
  }
  if (
    body.action !== "issue" &&
    body.action !== "discover" &&
    body.action !== "register" &&
    body.action !== "token" &&
    body.action !== "access"
  ) {
    return badRequest("action must be one of issue, discover, register, token, access");
  }

  if (body.action === "issue") {
    if (typeof body.altName !== "string" || body.altName.length === 0) {
      return badRequest("altName is required");
    }
    if (typeof body.scenario !== "string" || body.scenario.length === 0) {
      return badRequest("scenario is required");
    }
    try {
      const generated = await fetch(serverUrl + "/api/cert/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          altNames: [body.altName],
          password: BUNDLE_PASSWORD,
          provider: "Local",
          scenario: body.scenario,
          keyType: "Rsa",
        }),
      });
      if (!generated.ok) {
        throw new Error(`Certificate generation failed (HTTP ${generated.status}): ${await generated.text()}`);
      }
      const pfxBuffer = Buffer.from(await generated.arrayBuffer());
      const cert = await parseCertificate(pfxBuffer, BUNDLE_PASSWORD);
      const certificate = await describeCertificate(cert);
      // Later steps look the certificate up by this id, so a request cannot substitute a different certificate.
      const certId = "walkthrough-" + crypto.randomUUID();
      await addCertificate(certId, cert);
      return NextResponse.json({
        certId,
        pfx: pfxBuffer.toString("base64"),
        password: BUNDLE_PASSWORD,
        serial: leafSerialHex(cert),
        certificate,
      });
    } catch (e) {
      return errorResponse("Scenario walkthrough step failed", e, 500);
    }
  }

  // Every action past this point discovers or acts against the FHIR server.
  const fhirServer = normalizeServerUrl(body.fhirServer);
  if (!fhirServer) {
    return badRequest("fhirServer must be a valid http or https URL");
  }

  let resourceServerProxy: string | undefined;
  if (body.proxy?.resourceServer !== undefined) {
    const normalized = normalizeServerUrl(body.proxy.resourceServer);
    if (!normalized) {
      return badRequest("proxy.resourceServer must be a valid http or https URL");
    }
    resourceServerProxy = normalized;
  }
  let authorizationServerProxy: string | undefined;
  if (body.proxy?.authorizationServer !== undefined) {
    const normalized = normalizeServerUrl(body.proxy.authorizationServer);
    if (!normalized) {
      return badRequest("proxy.authorizationServer must be a valid http or https URL");
    }
    authorizationServerProxy = normalized;
  }
  let headers: Record<string, string> | undefined;
  if (body.headers !== undefined) {
    if (!Array.isArray(body.headers)) {
      return badRequest("headers must be an array");
    }
    headers = {};
    for (const entry of body.headers) {
      if (!entry || typeof entry !== "object" || typeof entry.name !== "string" || typeof entry.value !== "string") {
        return badRequest("Each headers entry must have a string name and value");
      }
      const name = entry.name.trim();
      if (!name) {
        continue;
      }
      // Control characters, whitespace, and colons cannot appear in an HTTP header name.
      if (/[\s:\x00-\x1f]/.test(name)) {
        return badRequest("headers entries must have valid header names");
      }
      headers[name] = entry.value;
    }
  }

  let transport: UdapTransport | undefined;
  if (resourceServerProxy || authorizationServerProxy || (headers && Object.keys(headers).length > 0)) {
    transport = { fhirServer, resourceServerProxy, authorizationServerProxy, headers };
  }

  // "discover", "register", and "token" all act on a certificate this route already issued and stored.
  // "access" only needs the bearer token it was given, not the certificate.
  if (body.action !== "access") {
    if (typeof body.certId !== "string" || !body.certId.startsWith("walkthrough-")) {
      return badRequest("certId is required");
    }
  }

  if (body.action === "discover") {
    try {
      let metadata: UdapMetadata;
      try {
        metadata = await discoverUdapEndpoint(fhirServer, transport);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({
          discovery: { metadata: {} as UdapMetadata, checks: [{ name: "well-known", result: "fail", message }] },
          securityServerCheck: { name: "issuer_matches_security_server", result: "fail", message: "No metadata to compare." },
        });
      }
      const signed = verifySignedMetadata(metadata.signed_metadata, fhirServer);
      const checks = judgeDiscovery(metadata, fhirServer, signed);
      const effective = applySignedMetadata(metadata, signed);
      const passed = discoveryPassed(checks);
      if (passed) {
        await addMetadata(body.certId as string, effective);
      }
      // A failed document may carry no usable registration_endpoint, so the comparison only runs on a pass.
      const securityServerCheck = passed
        ? judgeIssuerMatchesSecurityServer(effective, serverUrl)
        : { name: "issuer_matches_security_server", result: "fail" as const, message: "No valid metadata to compare." };
      return NextResponse.json({ discovery: { metadata: effective, checks }, securityServerCheck });
    } catch (e) {
      return errorResponse("Scenario walkthrough step failed", e, 500);
    }
  }

  if (body.action === "register") {
    if (typeof body.altName !== "string" || body.altName.length === 0) {
      return badRequest("altName is required");
    }
    const cert = await getCertificate(body.certId as string);
    if (!cert) {
      return badRequest("Certificate not found. The sandbox restarted; start over.");
    }
    const metadata = await getMetadata(body.certId as string);
    if (!metadata) {
      return badRequest("Run discovery first.");
    }
    const grantType = body.grantType ?? "client_credentials";
    if (grantType !== "client_credentials" && grantType !== "authorization_code") {
      return badRequest("grantType must be client_credentials or authorization_code");
    }
    let scopes = grantType === "authorization_code"
      ? ["user/Patient.read", "user/Observation.read"]
      : ["system/Patient.read", "system/Observation.read"];
    if (body.scopes !== undefined) {
      if (!Array.isArray(body.scopes) || body.scopes.length === 0 || body.scopes.some((s) => typeof s !== "string" || s.trim().length === 0)) {
        return badRequest("scopes must be a non-empty array of strings");
      }
      scopes = body.scopes.map((s) => s.trim());
    }
    try {
      const authorizationCode = grantType === "authorization_code";
      // The altName doubles as the redirect URI because the page URL is the SAN.
      // The logo comes from buildRegister's default, so logoUri is left unset here.
      const regReq: UdapClientRequest = {
        fhirServer,
        grantTypes: [grantType],
        issuer: body.altName,
        clientName: `Scenario walkthrough ${body.scenario ?? ""}`,
        contacts: ["mailto:tester@localhost.local"],
        scopes,
        ...(authorizationCode ? { redirectUris: [body.altName] } : {}),
      };
      const registration = await registerForOutcome(regReq, cert, transport, metadata);
      if (registration.outcome === "accepted") {
        const client = registration.body as UdapClient;
        await addClient(client.id, client);
      }
      return NextResponse.json({ registration });
    } catch (e) {
      return errorResponse("Scenario walkthrough step failed", e, 500);
    }
  }

  if (body.action === "token") {
    if (typeof body.clientId !== "string" || body.clientId.length === 0) {
      return badRequest("clientId is required");
    }
    try {
      const cert = await getCertificate(body.certId as string);
      if (!cert) {
        return badRequest("Certificate not found. The sandbox restarted; start over.");
      }
      const client = await getStoredClient(body.clientId);
      if (!client) {
        return badRequest("Client not found. The sandbox restarted; start over.");
      }
      let grant: AuthorizationCodeGrant | undefined;
      if (client.grantType === "authorization_code") {
        if (
          typeof body.code !== "string" || body.code.length === 0 ||
          typeof body.redirectUri !== "string" || body.redirectUri.length === 0 ||
          typeof body.codeVerifier !== "string" || body.codeVerifier.length === 0
        ) {
          return badRequest("code, redirectUri, and codeVerifier are required for an authorization_code client");
        }
        grant = { code: body.code, redirectUri: body.redirectUri, codeVerifier: body.codeVerifier };
      }
      const token = await requestTokenForOutcome(client, cert, transport, grant);
      return NextResponse.json({ token });
    } catch (e) {
      return errorResponse("Scenario walkthrough step failed", e, 500);
    }
  }

  // action === "access"
  if (typeof body.accessToken !== "string" || body.accessToken.length === 0) {
    return badRequest("accessToken is required");
  }
  try {
    const access = await readPatientForOutcome(fhirServer, body.accessToken, transport);
    return NextResponse.json({ access });
  } catch (e) {
    return errorResponse("Scenario walkthrough step failed", e, 500);
  }
}
