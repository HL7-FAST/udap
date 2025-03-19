import TestDefinition, { TestDefinitionParams } from "./test-definition";
import { TestResult } from "./test-result";

export interface TestSuiteParams {
  [key: string]: TestDefinitionParams;
}

export default abstract class TestSuite {

  public abstract readonly key: string;
  public abstract readonly name: string;
  public abstract readonly description: string;

  public tests: TestDefinition[] = [];

  constructor() {
  }
  

  public async *runAllTests(params: TestSuiteParams = {}): AsyncGenerator<Record<string, TestResult>> {

    if (!this.checkPrerequisites()) {
      return {}
    }

    console.log("Running test suite: " + this.key);
    console.log("test suite params:", params);

    const results: Record<string, TestResult> = {};

    for (const test of (this.tests||[])) {
      const testParams = params[test.key];
      console.log("Running test: " + test.key);
      console.log("Test Params: ", testParams);

      const testRes = await test.run(testParams);
      results[test.key] = testRes;

      yield { [test.key]: testRes };
    }

    return results;

  }


  public async runOneTest(testKey: string, params: TestDefinitionParams = {}): Promise<TestResult> {
    
    if (!this.checkPrerequisites()) {
      return {id: crypto.randomUUID(), result: "prerequisite-fail"};
    }

    const test = this.tests.find(t => t.key === testKey);
    if (!test) {
      throw new Error("Test not found for key:" + testKey);
    }
    console.log("Running test: " + testKey);

    return await test.run(params);
  }

  public checkPrerequisites(): boolean{
    return true;
  }

  public getResults(): void {
    throw new Error(this.constructor.name + "::getResults() not implemented.");
  }

}