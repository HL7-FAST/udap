import { describe, expect, test } from "bun:test";
import { judgeAccess } from "./access-judge";

describe("judgeAccess", () => {
  test("passes a 200 Bundle", () => {
    expect(judgeAccess({ status: 200, body: { resourceType: "Bundle", total: 1 }, url: "u" }).result).toBe("pass");
  });
  test("fails a 401", () => {
    const j = judgeAccess({ status: 401, body: { resourceType: "OperationOutcome" }, url: "u" });
    expect(j.result).toBe("fail");
    expect(j.message).toContain("401");
  });
  test("fails a 200 that is not a Bundle", () => {
    expect(judgeAccess({ status: 200, body: { resourceType: "Patient" }, url: "u" }).result).toBe("fail");
  });
});
