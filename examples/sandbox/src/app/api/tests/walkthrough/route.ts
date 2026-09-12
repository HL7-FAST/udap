import { NextRequest, NextResponse } from "next/server";
import { addCertificate, getCertificate, parseCertificate } from "@/lib/cert-store";
import { BUNDLE_PASSWORD, describeCertificate, leafSerialHex } from "@/lib/cert-inspect";
import { addClient, getStoredClient } from "@/lib/client-store";
import { UdapClient, UdapClientRequest } from "@/lib/models";
import { registerForOutcome } from "@/lib/register-outcome";
import { errorResponse, normalizeServerUrl } from "@/lib/route-helpers";
import { requestTokenForOutcome } from "@/lib/token-outcome";

export interface WalkthroughStepRequest {
  serverUrl: string;
  action: "issue" | "register" | "token";
  altName?: string;
  certId?: string;
  clientId?: string;
  scenario?: string;
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
  if (body.action !== "issue" && body.action !== "register" && body.action !== "token") {
    return badRequest("action must be one of issue, register, token");
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

  // "register" and "token" both act on a certificate this route already issued and stored.
  if (typeof body.certId !== "string" || !body.certId.startsWith("walkthrough-")) {
    return badRequest("certId is required");
  }

  if (body.action === "register") {
    if (typeof body.altName !== "string" || body.altName.length === 0) {
      return badRequest("altName is required");
    }
    const cert = await getCertificate(body.certId);
    if (!cert) {
      return badRequest("Certificate not found. The sandbox restarted; start over.");
    }
    try {
      const regReq: UdapClientRequest = {
        fhirServer: serverUrl,
        grantTypes: ["client_credentials"],
        issuer: body.altName,
        clientName: `Scenario walkthrough ${body.scenario ?? ""}`,
        contacts: ["mailto:tester@localhost"],
        scopes: ["system/Patient.read"],
      };
      const registration = await registerForOutcome(regReq, cert);
      if (registration.outcome === "accepted") {
        const client = registration.body as UdapClient;
        await addClient(client.id, client);
      }
      return NextResponse.json({ registration });
    } catch (e) {
      return errorResponse("Scenario walkthrough step failed", e, 500);
    }
  }

  // action === "token"
  if (typeof body.clientId !== "string" || body.clientId.length === 0) {
    return badRequest("clientId is required");
  }
  try {
    const cert = await getCertificate(body.certId);
    if (!cert) {
      return badRequest("Certificate not found. The sandbox restarted; start over.");
    }
    const client = await getStoredClient(body.clientId);
    if (!client) {
      return badRequest("Client not found. The sandbox restarted; start over.");
    }
    const token = await requestTokenForOutcome(client, cert);
    return NextResponse.json({ token });
  } catch (e) {
    return errorResponse("Scenario walkthrough step failed", e, 500);
  }
}
