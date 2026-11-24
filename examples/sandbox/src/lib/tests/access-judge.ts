import type { AccessRunOutcome } from "../access-outcome";

export type AccessCheckKey =
  | "patient-search"
  | "patient-read"
  | "patient-everything"
  | "patient-instance-everything"
  | "encounter-search";

/** `{id}` in a path stands for the patient id. */
export const ACCESS_CHECKS: Array<{ key: AccessCheckKey; path: string; resourceType: "Bundle" | "Patient" }> = [
  { key: "patient-search", path: "Patient", resourceType: "Bundle" },
  { key: "patient-read", path: "Patient/{id}", resourceType: "Patient" },
  { key: "patient-everything", path: "Patient/$everything", resourceType: "Bundle" },
  { key: "patient-instance-everything", path: "Patient/{id}/$everything", resourceType: "Bundle" },
  { key: "encounter-search", path: "Encounter", resourceType: "Bundle" },
];

/** The checks to run, in list order. With no patient id, the result has no check that needs one. */
export function accessRequests(patientId?: string): Array<{ key: AccessCheckKey; path: string; label: string }> {
  return ACCESS_CHECKS.filter((check) => patientId || !check.path.includes("{id}")).map((check) => {
    const path = check.path.replace("{id}", () => patientId ?? "");
    return { key: check.key, path, label: "GET " + path };
  });
}

/** The patient of a token: the `patient` claim, else the id at the end of a `fhirUser` that names a Patient. */
export function patientIdFromClaims(claims: Record<string, unknown>): string | undefined {
  if (typeof claims.patient === "string" && claims.patient.length > 0) {
    return claims.patient;
  }
  const match = typeof claims.fhirUser === "string" ? /(?:^|\/)Patient\/([^/]+)$/.exec(claims.fhirUser) : null;
  return match?.[1];
}

export interface AccessJudgement {
  result: "pass" | "fail" | "info";
  message: string;
}

function diagnostics(body: unknown): string | undefined {
  if (body && typeof body === "object" && Array.isArray((body as { issue?: unknown }).issue)) {
    const first = (body as { issue: Array<{ diagnostics?: unknown }> }).issue[0];
    return typeof first?.diagnostics === "string" ? first.diagnostics : undefined;
  }
  return undefined;
}

function resourceTypeOf(body: unknown): string | undefined {
  const type = body !== null && typeof body === "object" ? (body as { resourceType?: unknown }).resourceType : undefined;
  return typeof type === "string" ? type : undefined;
}

export function judgeAccess(o: AccessRunOutcome): AccessJudgement {
  const expected = ACCESS_CHECKS.find((check) => check.key === o.key)?.resourceType;
  const actual = resourceTypeOf(o.body);
  if (o.status === 200 && actual !== undefined && actual === expected) {
    return { result: "pass", message: `The resource server returned a ${expected} for the bearer token.` };
  }
  const detail = diagnostics(o.body);
  // A 403 is the correct answer when the scopes of the token do not cover the request, so it is not a failure.
  if (o.status === 403) {
    return {
      result: "info",
      message: detail
        ? `The resource server denied the request for this token: ${detail}`
        : "The resource server denied the request for this token.",
    };
  }
  if (o.status === 200) {
    const found = `Resource server returned HTTP 200 with ${actual ?? "no FHIR resource"}, expected ${expected}`;
    return { result: "fail", message: detail ? `${found}: ${detail}` : `${found}.` };
  }
  return {
    result: "fail",
    message: detail
      ? `Resource server returned HTTP ${o.status}: ${detail}`
      : `Resource server returned HTTP ${o.status}.`,
  };
}

export function accessPassed(outcomes: AccessRunOutcome[]): boolean {
  return outcomes.some((o) => judgeAccess(o).result === "pass");
}
