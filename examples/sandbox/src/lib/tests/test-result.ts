
export interface TestResult {
  id: string;
  result: "pass" | "fail" | "skip" | "prerequisite-fail";
  message?: string;
  details?: string;
}