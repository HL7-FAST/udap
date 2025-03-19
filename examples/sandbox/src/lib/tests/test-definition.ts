import { TestResult } from "./test-result";

export interface TestDefinitionParams {
  [key: string]: unknown;
}

export default abstract class TestDefinition {
  public abstract readonly key: string;
  public abstract readonly name: string;
  public abstract readonly description: string;

  constructor() {
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async run(params: TestDefinitionParams): Promise<TestResult> {
    throw new Error(this.constructor.name + "::run() not implemented.");
  }

  public checkPrerequisites(): boolean{
    return true;
  }

  public getResults(): void {
    throw new Error(this.constructor.name + "::getResults() not implemented.");
  }

}
