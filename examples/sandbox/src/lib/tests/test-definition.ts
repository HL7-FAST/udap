import { TestResult } from "./test-result";

export interface TestDefinitionParams {
  suiteKey?: string;
  [key: string]: unknown;
}

export interface BeforeTestOutcome {
  success: boolean;
  isFatal?: boolean;
  message?: string;
}

export interface AfterTestOutcome {
  success: boolean;
  message?: string;
}

export default interface TestDefinitionModel<
  T extends TestDefinitionParams = TestDefinitionParams,
> {
  readonly testKey: string;
  readonly name: string;
  readonly description?: string;
  params: T;

  run(params?: T): Promise<TestResult>;

  before?(params?: T): Promise<BeforeTestOutcome>;
  execute(params?: T): Promise<TestResult>;
  after?(result: TestResult): Promise<AfterTestOutcome>;
}

export function getTestDefinition<T extends TestDefinitionParams>(
  testKey: string,
  name: string,
  description?: string,
  params?: T,
): TestDefinitionModel<T> {
  return {
    testKey: testKey,
    name,
    description,
    params: params || ({} as T),
    async run(params?: T): Promise<TestResult> {
      
      // run prereq check if implemented
      let beforeMessage: string | undefined;
      if (this.before) {
        const beforeOutcome = await this.before(params);
        if (!beforeOutcome.success) {
          if (beforeOutcome.isFatal) {
            return {
              id: crypto.randomUUID(),
              status: "before-test-fail",
              messages: beforeOutcome.message ? [beforeOutcome.message] : [],
              params: this.params,
              steps: [],
            };
          }
        }
      }

      // execute the test
      const result = await this.execute(params);

      // add non-fatal prereq message if any
      if (beforeMessage) {
        result.messages = [beforeMessage, ...result.messages];
      }

      // run post check if implemented
      if (this.after) {
        const afterOutcome = await this.after(result);
        if (!afterOutcome.success) {
          result.status = "after-test-fail";
          if (afterOutcome.message) {
            result.messages = [...result.messages, afterOutcome.message];
          }
        }
      }

      return result;
    },
    async execute(): Promise<TestResult> {
      return {
        id: crypto.randomUUID(),
        status: "unknown",
        params: this.params,
        messages: [],
        steps: [],
      };
    },
  };
}
