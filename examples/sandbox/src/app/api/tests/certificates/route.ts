import { NextRequest, NextResponse } from "next/server";
import { BUNDLE_PASSWORD, describeCertificate } from "@/lib/cert-inspect";
import { parseCertificate } from "@/lib/cert-store";
import { registerForOutcome } from "@/lib/register-outcome";
import { errorResponse, normalizeServerUrl } from "@/lib/route-helpers";
import { TrustRunOutcome } from "@/lib/tests/trust-outcome";

export interface TrustRunRequest {
  serverUrl: string;
  scenario: string;
  altName: string;
}

/** Proxies the server's scenario catalog so the browser never needs to trust the server's TLS certificate. */
export async function GET(request: NextRequest): Promise<Response> {
  const rawServerUrl = request.nextUrl.searchParams.get("serverUrl");
  if (!rawServerUrl) {
    return NextResponse.json({ status: "error", message: "serverUrl is required" }, { status: 400 });
  }
  const serverUrl = normalizeServerUrl(rawServerUrl);
  if (!serverUrl) {
    return NextResponse.json(
      { status: "error", message: "serverUrl must be a valid http or https URL" },
      { status: 400 },
    );
  }
  try {
    const response = await fetch(serverUrl + "/api/cert/scenarios");
    if (!response.ok) {
      throw new Error(`Scenario catalog returned HTTP ${response.status}`);
    }
    const scenarios = await response.json();
    if (!Array.isArray(scenarios)) {
      throw new Error("Scenario catalog response was not an array");
    }
    return NextResponse.json(scenarios);
  } catch (e) {
    return errorResponse("Failed to load the scenario catalog", e, 502);
  }
}

/** Generates the scenario certificate on the server and registers with it. A rejection is a normal outcome, not an error. */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const rawBody: unknown = await request.json();
    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json({ status: "error", message: "Request body must be an object" }, { status: 400 });
    }
    const body = rawBody as TrustRunRequest;
    if (typeof body.serverUrl !== "string") {
      return NextResponse.json({ status: "error", message: "serverUrl must be a string" }, { status: 400 });
    }
    const serverUrl = normalizeServerUrl(body.serverUrl);
    if (!serverUrl) {
      return NextResponse.json(
        { status: "error", message: "serverUrl must be a valid http or https URL" },
        { status: 400 },
      );
    }
    if (typeof body.scenario !== "string" || body.scenario.length === 0) {
      return NextResponse.json({ status: "error", message: "scenario is required" }, { status: 400 });
    }
    if (typeof body.altName !== "string" || body.altName.length === 0) {
      return NextResponse.json({ status: "error", message: "altName is required" }, { status: 400 });
    }

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
      throw new Error(
        `Certificate generation failed (HTTP ${generated.status}): ${await generated.text()}`,
      );
    }
    const cert = await parseCertificate(Buffer.from(await generated.arrayBuffer()), BUNDLE_PASSWORD);
    const certificate = await describeCertificate(cert);

    let outcome: TrustRunOutcome;
    try {
      outcome = await registerForOutcome(
        {
          fhirServer: serverUrl,
          grantTypes: ["client_credentials"],
          issuer: body.altName,
          clientName: `Certificate validation ${body.scenario}`,
          contacts: ["mailto:tester@localhost.local"],
          scopes: ["system/Patient.read"],
        },
        cert,
      );
    } catch (e) {
      // The certificate was inspected successfully; only registration failed unexpectedly.
      // Report that as data, not a 500, so the inspect step's result still reaches the client.
      return NextResponse.json({
        certificate,
        registrationError: e instanceof Error ? e.message : "Unknown error",
      });
    }
    return NextResponse.json({ certificate, registration: outcome });
  } catch (e) {
    return errorResponse("Certificate scenario run failed", e, 500);
  }
}
