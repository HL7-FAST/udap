import Client from "fhir-kit-client";
import { CapabilityStatement, OperationOutcome } from "fhir/r4";

export async function getServerCapabilityStatement(
  fhirServer: string,
): Promise<CapabilityStatement> {
  const client = new Client({ baseUrl: fhirServer });
  const cs = await client.capabilityStatement();
  if (cs.resourceType !== "CapabilityStatement") {
    console.error("Did not receive a CapabilityStatement.  Received:", cs);
  }
  return cs as CapabilityStatement;
}

export function getResourceTypes(capabilityStatement: CapabilityStatement): string[] {
  const types = capabilityStatement.rest?.[0].resource?.map((r) => r.type);
  return types || [];
}

export type OperationOutcomeSeverity = "fatal" | "error" | "warning" | "information";

export function getOperationOutcomeResponse(
  diagnostics: string,
  severity: OperationOutcomeSeverity,
  code: string = "processing",
  status: number = 200,
): Response {
  const outcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    issue: [
      {
        severity: severity,
        code: code,
        diagnostics: diagnostics,
      },
    ],
  };

  const response = new Response(JSON.stringify(outcome), {
    status: status,
    headers: {
      "Content-Type": "application/fhir+json",
    },
  });
  return response;
}

export function getBadRequestResponse(
  diagnostics: string,
  severity: OperationOutcomeSeverity = "error",
  code: string = "processing",
) {
  return getOperationOutcomeResponse(diagnostics, severity, code, 400);
}

export function getInternalServerErrorResponse(
  diagnostics: string,
  severity: OperationOutcomeSeverity = "error",
  code: string = "processing",
): Response {
  return getOperationOutcomeResponse(diagnostics, severity, code, 500);
}
