import { describe, expect, test } from "bun:test";
import { accessRequests, judgeAccess, patientIdFromClaims } from "./access-judge";

describe("judgeAccess", () => {
  test("passes a 200 Bundle", () => {
    expect(judgeAccess({ key: "patient-search", label: "l", status: 200, body: { resourceType: "Bundle", total: 1 }, url: "u" }).result).toBe("pass");
  });
  test("passes patient-read on a Patient and fails it on a Bundle", () => {
    expect(judgeAccess({ key: "patient-read", label: "l", status: 200, body: { resourceType: "Patient" }, url: "u" }).result).toBe("pass");
    expect(judgeAccess({ key: "patient-read", label: "l", status: 200, body: { resourceType: "Bundle" }, url: "u" }).result).toBe("fail");
  });
  test("reports a 403 as info", () => {
    expect(judgeAccess({ key: "patient-everything", label: "l", status: 403, body: {}, url: "u" }).result).toBe("info");
  });
  test("fails a 401", () => {
    const j = judgeAccess({ key: "patient-search", label: "l", status: 401, body: { resourceType: "OperationOutcome" }, url: "u" });
    expect(j.result).toBe("fail");
    expect(j.message).toContain("401");
  });
});

describe("accessRequests", () => {
  test("fills the patient id into the paths in list order", () => {
    expect(accessRequests("x1").map((r) => r.path)).toEqual([
      "Patient",
      "Patient/x1",
      "Patient/$everything",
      "Patient/x1/$everything",
      "Encounter",
    ]);
  });
  test("leaves out the two checks that need a patient id when there is none", () => {
    expect(accessRequests().map((r) => r.key)).toEqual(["patient-search", "patient-everything", "encounter-search"]);
  });
});

test("patientIdFromClaims reads the patient claim, else a Patient fhirUser", () => {
  expect(patientIdFromClaims({ patient: "p1", fhirUser: "https://h/fhir/Patient/p2" })).toBe("p1");
  expect(patientIdFromClaims({ fhirUser: "https://h/fhir/Patient/p2" })).toBe("p2");
  expect(patientIdFromClaims({ fhirUser: "Patient/p3" })).toBe("p3");
  expect(patientIdFromClaims({ fhirUser: "Practitioner/d1" })).toBeUndefined();
});
