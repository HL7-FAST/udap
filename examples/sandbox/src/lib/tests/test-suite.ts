import TestDefinitionModel, { TestDefinitionParams } from "./test-definition";
import { TestResult } from "./test-result";

export interface TestSuiteParams {
  suiteKey: string;
  [key: string]: unknown;
}

interface SuiteTest {
  component: React.JSX.Element;
  model: TestDefinitionModel<TestDefinitionParams>;
}

export interface TestSuiteModel<T extends TestSuiteParams = TestSuiteParams> {
  readonly suiteKey: string;
  readonly name: string;
  readonly description: string;
  tests: SuiteTest[];
  params: T;

  before?(params?: T): Promise<boolean>;
  after?(params?: T): Promise<boolean>;
  runAllTests(
    tests: TestDefinitionModel[],
  ): AsyncGenerator<{ testKey: string; result: TestResult }>;
  runOneTest(testKey: string, params?: TestDefinitionParams): Promise<TestResult>;
}

export function getTestSuite<T extends TestSuiteParams>(
  suiteKey: string,
  name: string,
  description: string,
  tests: SuiteTest[],
  params?: T,
): TestSuiteModel {
  return {
    suiteKey: suiteKey,
    name,
    description,
    tests: tests,
    params: params || ({} as T),

    async *runAllTests(
      tests?: TestDefinitionModel[],
    ): AsyncGenerator<{ testKey: string; result: TestResult }> {
      if (!tests) {
        tests = this.tests.map((t) => t.model);
      }

      // console.log("Running test suite: " + this.suiteKey);
      // console.log("test suite params:", params);

      const results: Record<string, TestResult> = {};

      for (const test of tests || []) {
        const testRes = await test.run();
        results[test.testKey] = testRes;
        yield { testKey: test.testKey, result: testRes };
      }

      return results;
    },

    async runOneTest(testKey: string): Promise<TestResult> {
      const test = this.tests.find((t) => t.model.testKey === testKey);
      if (!test) {
        throw new Error("Test not found for key:" + testKey);
      }
      console.log("Running test: " + testKey);

      return await test.model.run();
    },
  };
}
