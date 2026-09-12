import { describe, expect, test } from "bun:test";
import { CertScenarioSummary, judgeTrustOutcome } from "./trust-outcome";

const expired: CertScenarioSummary = {
  key: "expired",
  title: "Rejected scenario",
  summary: "",
  expected: "rejected",
  expectedError: "unapproved_software_statement",
  references: [],
};

const valid: CertScenarioSummary = {
  ...expired,
  key: "valid",
  title: "Accepted scenario",
  expected: "accepted",
  expectedError: null,
};

describe("judgeTrustOutcome", () => {
  test("accepted when accepted was expected passes", () => {
    const judgement = judgeTrustOutcome(valid, { outcome: "accepted", body: {} });
    expect(judgement.result).toBe("pass");
  });

  test("rejected with the expected error and HTTP 400 passes", () => {
    const judgement = judgeTrustOutcome(expired, {
      outcome: "rejected",
      status: 400,
      body: { error: "unapproved_software_statement" },
    });
    expect(judgement.result).toBe("pass");
  });

  test("rejected with a different error fails and names both codes", () => {
    const judgement = judgeTrustOutcome(expired, {
      outcome: "rejected",
      status: 400,
      body: { error: "invalid_software_statement" },
    });
    expect(judgement.result).toBe("fail");
    expect(judgement.message).toContain("unapproved_software_statement");
    expect(judgement.message).toContain("invalid_software_statement");
  });

  test("rejected without an error code fails", () => {
    const judgement = judgeTrustOutcome(expired, { outcome: "rejected", status: 400, body: "nope" });
    expect(judgement.result).toBe("fail");
    expect(judgement.message).toContain("(none)");
  });

  test("rejected with a status other than 400 fails", () => {
    const judgement = judgeTrustOutcome(expired, {
      outcome: "rejected",
      status: 500,
      body: { error: "unapproved_software_statement" },
    });
    expect(judgement.result).toBe("fail");
  });

  test("accepted when rejected was expected fails", () => {
    const judgement = judgeTrustOutcome(expired, { outcome: "accepted", body: {} });
    expect(judgement.result).toBe("fail");
  });

  test("rejected when accepted was expected fails", () => {
    const judgement = judgeTrustOutcome(valid, {
      outcome: "rejected",
      status: 400,
      body: { error: "unapproved_software_statement" },
    });
    expect(judgement.result).toBe("fail");
  });
});
