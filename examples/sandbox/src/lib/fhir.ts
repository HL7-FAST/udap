import { OperationOutcome } from "fhir/r4";


export type OperationOutcomeSeverity = "fatal"|"error"|"warning"|"information";

export function getOperationOutcomeResponse(
  diagnostics: string, 
  severity: OperationOutcomeSeverity,
  code: string = "processing",
  status: number = 200
): Response {

  const outcome: OperationOutcome = {
    resourceType: "OperationOutcome",
    issue: [
      {
        severity: severity,
        code: code,
        diagnostics: diagnostics
      }
    ]
  }

  const response = new Response(JSON.stringify(outcome), { 
    status: status,
    headers: {
      'Content-Type': 'application/fhir+json'
    }
  });
  return response;
}


export function getBadRequestResponse(
  diagnostics: string, 
  severity: OperationOutcomeSeverity = "error",
  code: string = "processing"
) {
  return getOperationOutcomeResponse(diagnostics, severity, code, 400);
}


export function getInternalServerErrorResponse(
  diagnostics: string, 
  severity: OperationOutcomeSeverity = "error",
  code: string = "processing"
): Response {
  return getOperationOutcomeResponse(diagnostics, severity, code, 500);
}