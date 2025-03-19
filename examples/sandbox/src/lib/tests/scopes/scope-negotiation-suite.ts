import TestSuite from "../test-suite";
import ScopesSupportedTest from "./scopes-supported";


export default class ScopeNegotiationTestSuite extends TestSuite {
  public key: string = "scope-negotiation";
  public name: string = "Scope Negotiation";
  public description: string = `
  This contains tests for scope negotiation based on the 
  <a href="https://build.fhir.org/ig/HL7/fhir-udap-security-ig/general.html#scope-negotiation" target="_blank" rel="noopener">guidelines</a>
  in the implementation guide.
  `;

  tests = [
    new ScopesSupportedTest()
  ];

  
}

