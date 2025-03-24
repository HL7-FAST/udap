import { TestResult } from "./test-result";
import { setCurrentTestKey } from "./test-store";

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

  run(): Promise<TestResult>;

  before?(): Promise<BeforeTestOutcome>;
  execute(): Promise<TestResult|undefined>;
  resume?(): Promise<TestResult|undefined>;
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

      // set the current test key for the session
      setCurrentTestKey(testKey);
      
      // run prereq check if implemented
      let beforeMessage: string | undefined;
      if (this.before) {
        const beforeOutcome = await this.before();
        if (!beforeOutcome.success) {
          if (beforeOutcome.isFatal) {
            return {
              id: crypto.randomUUID(),
              status: "before-test-fail",
              messages: beforeOutcome.message ? [beforeOutcome.message] : [],
              dateStarted: new Date(),
              params: this.params,
              steps: [],
            };
          }
        }
      }

      // execute the test
      let result = await this.execute();
      if (!result) {
        result = {
          id: crypto.randomUUID(),
          status: "unknown",
          params: this.params,
          dateStarted: new Date(),
          messages: [],
          steps: [],
        };
      }
      // add non-fatal prereq message if any
      if (beforeMessage) {
        result.messages = [beforeMessage, ...result.messages];
      }


      if (result.status === "waiting" && this.resume) {
        return result;
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
        dateStarted: new Date(),
        messages: [],
        steps: [],
      };
    },
  };
}
