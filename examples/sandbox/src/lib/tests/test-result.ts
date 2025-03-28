import { TestDefinitionParams } from "./test-definition";
import { setCurrentTestStepKey } from "./test-store";

export type TestStepResult = "pass" | "fail" | "skip" | "waiting" | "warn" | "info" | "unknown";

/**
 * Represents a single step in a defined test.
 */
export interface TestStep {
  id: string;
  key: string;
  name: string;
  description: string;
  dateStarted: Date;
  dateCompleted?: Date;
  result: TestStepResult;
  input?: unknown;
  output?: unknown;

  /**
   * Markdown-formatted message to display to the user.
   */
  message?: string;
}

export type TestResultStatus =
  | "pass"
  | "fail"
  | "skip"
  | "waiting"
  | "warn"
  | "fail-with-warning"
  | "before-test-fail"
  | "after-test-fail"
  | "unknown";

/**
 * Represents the result of a single run of a test.
 */
export interface TestResult {
  id: string;
  status: TestResultStatus;
  dateStarted: Date;
  dateCompleted?: Date;
  params: TestDefinitionParams;
  messages: string[];
  steps: TestStep[];
}

export function getNewStep(
  key: string,
  name: string,
  description: string,
  initialResult: TestStepResult = "unknown",
  setCurrentStepKey: boolean = true,
): TestStep {
  if (setCurrentStepKey) {
    setCurrentTestStepKey(key);
  }
  return {
    id: crypto.randomUUID(),
    key,
    name,
    description,
    dateStarted: new Date(),
    result: initialResult,
  };
}

export function getOverallResultStatus(result: TestResult): TestResultStatus {
  if (result.status === "fail") {
    return "fail";
  }

  if (result.steps) {
    if (result.steps.some((step) => !["pass", "skip", "info"].includes(step.result))) {
      if (result.steps.some((step) => step.result === "warn")) {
        return "fail-with-warning";
      }
      return "fail";
    }
    return "pass";
  }

  return result.status;
}

export function handleError(step: TestStep, e: unknown, result: TestStepResult = "fail"): TestStep {
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
