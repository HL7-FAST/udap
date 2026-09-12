import { describe, expect, test } from "bun:test";
import {
  judgeRegistrationAfterRevocation,
  judgeTokenAfterRevocation,
  judgeTokenBeforeRevocation,
} from "./revocation-outcome";

describe("judgeTokenBeforeRevocation", () => {
  test("passes when a token was issued", () => {
    expect(judgeTokenBeforeRevocation({ outcome: "issued", accessToken: "", claims: {} }).result).toBe("pass");
  });

  test("fails with the error and description when rejected", () => {
    const judgement = judgeTokenBeforeRevocation({
      outcome: "rejected",
      status: 400,
      body: { error: "invalid_client", error_description: "certificate not trusted" },
    });
    expect(judgement.result).toBe("fail");
    expect(judgement.message).toBe(
      "Token endpoint rejected the certificate before revocation: invalid_client: certificate not trusted",
    );
  });

  test("falls back to (none) when the body carries no error fields", () => {
    const judgement = judgeTokenBeforeRevocation({ outcome: "rejected", status: 400, body: {} });
    expect(judgement.message).toBe("Token endpoint rejected the certificate before revocation: (none): (none)");
  });
});

describe("judgeTokenAfterRevocation", () => {
  test("passes when rejected with invalid_client", () => {
    const judgement = judgeTokenAfterRevocation({
      outcome: "rejected",
      status: 401,
      body: { error: "invalid_client" },
    });
    expect(judgement.result).toBe("pass");
  });

  test("fails when a token was issued for a revoked certificate", () => {
    const judgement = judgeTokenAfterRevocation({ outcome: "issued", accessToken: "", claims: {} });
    expect(judgement.result).toBe("fail");
    expect(judgement.message).toBe("Token endpoint issued a token with a revoked certificate.");
  });

  test("fails when rejected with a different error", () => {
    const judgement = judgeTokenAfterRevocation({
      outcome: "rejected",
      status: 400,
      body: { error: "invalid_request" },
    });
    expect(judgement.result).toBe("fail");
    expect(judgement.message).toBe(
      "Token endpoint rejected the certificate, but with invalid_request instead of invalid_client.",
    );
  });

  test("fails with (none) when the rejection body is not an object", () => {
    const judgement = judgeTokenAfterRevocation({ outcome: "rejected", status: 500, body: "boom" });
    expect(judgement.message).toContain("(none)");
  });
});

describe("judgeRegistrationAfterRevocation", () => {
  test("passes when rejected with unapproved_software_statement", () => {
    const judgement = judgeRegistrationAfterRevocation({
      outcome: "rejected",
      status: 400,
      body: { error: "unapproved_software_statement" },
    });
    expect(judgement.result).toBe("pass");
  });

  test("fails when registration accepted a revoked certificate", () => {
    const judgement = judgeRegistrationAfterRevocation({ outcome: "accepted", body: {} });
    expect(judgement.result).toBe("fail");
    expect(judgement.message).toBe("Registration accepted a revoked certificate.");
  });

  test("fails when rejected with a different error", () => {
    const judgement = judgeRegistrationAfterRevocation({
      outcome: "rejected",
      status: 400,
      body: { error: "invalid_client_metadata" },
    });
    expect(judgement.result).toBe("fail");
    expect(judgement.message).toBe(
      "Registration rejected the certificate, but with invalid_client_metadata instead of unapproved_software_statement.",
    );
  });
});
