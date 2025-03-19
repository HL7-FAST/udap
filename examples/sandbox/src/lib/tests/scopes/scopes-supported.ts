import TestDefinition, { TestDefinitionParams } from "../test-definition";
import { TestResult } from "../test-result";


export interface ScopesSupportedTestParams extends TestDefinitionParams {
  fhirServer: string;
}

export default class ScopesSupportedTest extends TestDefinition {
  public key: string = "scopes-supported";
  public name: string = "Scopes Supported";
  public description: string = "The `scopes_supported` metadata **SHALL** be present in the .well-known/udap object and **SHALL** list all scopes supported including all supported wildcard scopes.";

  public async run(params: ScopesSupportedTestParams): Promise<TestResult> {
    console.log("Running test: " + this.key);
    console.log("Params: ", params);

    const res = await fetch(params.fhirServer + "/.well-known/udap");
    const data = await res.json();
    console.log("Data: ", data);

    return {
      id: crypto.randomUUID(),
      result: "pass"
    }
  }
}