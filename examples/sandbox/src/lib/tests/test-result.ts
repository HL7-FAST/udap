import { TestDefinitionParams } from "./test-definition";

export type TestStepResult = "pass" | "fail" | "skip" | "info" | "unknown";

/**
 * Represents a single step in a defined test.
 */
export interface TestStep {
  id: string;
  key: string;
  name: string;
  description: string;
  result: TestStepResult;
  output?: unknown;
  message?: string;
}

export type TestResultStatus =
  | "pass"
  | "fail"
  | "skip"
  | "before-test-fail"
  | "after-test-fail"
  | "unknown";

/**
 * Represents the result of a single run of a test.
 */
export interface TestResult {
  id: string;
  status: TestResultStatus;
  params: TestDefinitionParams;
  messages: string[];
  steps: TestStep[];
}

export function getNewStep(
  key: string,
  name: string,
  description: string,
  initialResult: TestStepResult = "unknown",
): TestStep {
  return {
    id: crypto.randomUUID(),
    key,
    name,
    description,
    result: initialResult,
  };
}

export function getOverallResult(result: TestResult): TestResultStatus {
  if (result.status === "fail") {
    return "fail";
  }

  if (result.steps) {
    if (
      result.steps.some(
        (step) => !["pass", "skip", "info"].includes(step.result),
      )
    ) {
      return "fail";
    }
    return "pass";
  }

  return result.status;
}

export function handleError(
  step: TestStep,
  e: unknown,
  result: TestStepResult = "fail",
): TestStep {
  step.result = result;
  step.output = e;

  if (typeof e === "object" && e instanceof Error) {
    step.message = e.message;
  } else if (typeof e === "string") {
    step.message = e;
  } else if (e && typeof e === "object" && "message" in e) {
    step.message = e.message?.toString() ?? "Unknown error";
  } else {
    step.message = "Unknown error";
  }

  return step;
}
