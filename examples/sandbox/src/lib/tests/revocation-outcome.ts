import type { TokenRunOutcome } from "../token-outcome";
import { TrustRunOutcome } from "./trust-outcome";

export interface StepJudgement {
  result: "pass" | "fail";
  message: string;
}

function errorField(body: unknown, field: "error" | "error_description"): string | undefined {
  if (body && typeof body === "object" && field in body) {
    const value = (body as Record<string, unknown>)[field];
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

export function judgeTokenBeforeRevocation(o: TokenRunOutcome): StepJudgement {
  if (o.outcome === "issued") {
    return { result: "pass", message: "Token endpoint issued an access token." };
  }
  return {
    result: "fail",
    message: `Token endpoint rejected the certificate before revocation: ${errorField(o.body, "error") ?? "(none)"}: ${errorField(o.body, "error_description") ?? "(none)"}`,
  };
}

export function judgeTokenAfterRevocation(o: TokenRunOutcome): StepJudgement {
  if (o.outcome === "issued") {
    return { result: "fail", message: "Token endpoint issued a token with a revoked certificate." };
  }
  const error = errorField(o.body, "error");
  if (error === "invalid_client") {
    return { result: "pass", message: "Token endpoint rejected the revoked certificate with invalid_client." };
  }
  return {
    result: "fail",
    message: `Token endpoint rejected the certificate, but with ${error ?? "(none)"} instead of invalid_client.`,
  };
}

export function judgeRegistrationAfterRevocation(o: TrustRunOutcome): StepJudgement {
  if (o.outcome === "accepted") {
    return { result: "fail", message: "Registration accepted a revoked certificate." };
  }
  const error = errorField(o.body, "error");
  if (error === "unapproved_software_statement") {
    return {
      result: "pass",
      message: "Registration rejected the revoked certificate with unapproved_software_statement.",
    };
  }
  return {
    result: "fail",
    message: `Registration rejected the certificate, but with ${error ?? "(none)"} instead of unapproved_software_statement.`,
  };
}
