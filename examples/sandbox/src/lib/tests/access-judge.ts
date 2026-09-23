import { AccessRunOutcome } from "../access-outcome";
import { StepJudgement } from "./revocation-outcome";

function diagnostics(body: unknown): string | undefined {
  if (body && typeof body === "object" && Array.isArray((body as { issue?: unknown }).issue)) {
    const first = (body as { issue: Array<{ diagnostics?: unknown }> }).issue[0];
    return typeof first?.diagnostics === "string" ? first.diagnostics : undefined;
  }
  return undefined;
}

export function judgeAccess(o: AccessRunOutcome): StepJudgement {
  const isBundle = o.body !== null && typeof o.body === "object" && (o.body as { resourceType?: unknown }).resourceType === "Bundle";
  if (o.status === 200 && isBundle) {
    return { result: "pass", message: "The resource server returned a Bundle for the bearer token." };
  }
  const detail = diagnostics(o.body);
  return {
    result: "fail",
    message: detail
      ? `Resource server returned HTTP ${o.status}: ${detail}`
      : `Resource server returned HTTP ${o.status}.`,
  };
}
