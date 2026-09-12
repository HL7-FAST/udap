import { CertificateFacts } from "./cert-facts";

// Shapes mirror GET /api/cert/scenarios on the FAST Security RI (camelCase JSON).
export interface SpecReference {
  source: string;
  section: string;
  url: string;
  quote: string;
  shortLabel: string;
}

export interface CertScenarioSummary {
  key: string;
  title: string;
  summary: string;
  expected: "accepted" | "rejected";
  expectedError: string | null;
  references: SpecReference[];
}

/** What POST /api/tests/trust reports. `status` is the registration HTTP status and is only present on rejection. */
export interface TrustRunOutcome {
  outcome: "accepted" | "rejected";
  status?: number;
  body: unknown;
}

export interface TrustJudgement {
  result: "pass" | "fail";
  message: string;
}

/** What POST /api/tests/trust returns: the inspected certificate and the registration outcome. `registration` is
 * absent, and `registrationError` set instead, when registration failed for a reason other than a rejection. */
export interface TrustRunResponse {
  certificate: CertificateFacts;
  registration?: TrustRunOutcome;
  registrationError?: string;
}

function errorCode(body: unknown): string | undefined {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return undefined;
}

export function judgeTrustOutcome(
  scenario: CertScenarioSummary,
  run: TrustRunOutcome,
): TrustJudgement {
  if (run.outcome !== scenario.expected) {
    return {
      result: "fail",
      message: `Expected the registration to be ${scenario.expected} but it was ${run.outcome}${run.status ? ` (HTTP ${run.status})` : ""}.`,
    };
  }

  if (run.outcome === "accepted") {
    return { result: "pass", message: "Registration accepted, as expected." };
  }

  const actual = errorCode(run.body) ?? "(none)";
  if (run.status !== 400 || actual !== scenario.expectedError) {
    return {
      result: "fail",
      message: `Expected HTTP 400 with error \`${scenario.expectedError}\` but got HTTP ${run.status} with error \`${actual}\`.`,
    };
  }

  return {
    result: "pass",
    message: `Registration rejected with HTTP 400 and error \`${scenario.expectedError}\`, as expected.`,
  };
}
