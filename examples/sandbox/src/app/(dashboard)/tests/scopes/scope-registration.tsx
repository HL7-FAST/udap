import TestDefinition from "@/components/tests/test-definition";
import { UdapMetadata } from "@/lib/models";
import TestDefinitionModel, {
  BeforeTestOutcome,
  TestDefinitionParams,
  getTestDefinition,
} from "@/lib/tests/test-definition";
import { TestResult } from "@/lib/tests/test-result";
import { getCurrentTestSessionParam } from "@/lib/tests/test-store";
import { formatMarkdownDescription } from "@/lib/utils";

export interface ScopeRegistrationTestParams extends TestDefinitionParams {
  fhirServer: string;
  udapWellknown: UdapMetadata|undefined;
  setUdapWellknown: (metadata: UdapMetadata) => void;
}


export function getScopeRegistrationTest(
  params: ScopeRegistrationTestParams,
): TestDefinitionModel<ScopeRegistrationTestParams> {

  return {
    ...getTestDefinition<ScopeRegistrationTestParams>(
      "scope-registration",
      "Scope Registration",
      formatMarkdownDescription(`
        Attempts to register a client with different scope secnarios based on the server's supported scopes.
        `),
      params,
    ),

    /**
     * Ensure that the UDAP discovery document is available for the registration tests.
     */
    async before(params: ScopeRegistrationTestParams): Promise<BeforeTestOutcome> {

      // Already have the UDAP discovery document as a parameter
      if (params.udapWellknown) {
        this.params.udapWellknown = params.udapWellknown;
        return { success: true };
      }

      // Check if it's available in test session data
      const sessionParam = getCurrentTestSessionParam("udapWellknown");
      if (sessionParam) {
        this.params.udapWellknown = sessionParam as UdapMetadata;
        return { success: true };
      }

      return { success: false, message: "No UDAP discovery document available." };
    },

    async execute(params: ScopeRegistrationTestParams): Promise<TestResult> {

      const result: TestResult = {
        id: crypto.randomUUID(),
        status: "pass",
        params: params,
        messages: [],
        steps: [],
      };

      return result;
    },
  };
}

export default function ScopeRegistrationTest(
  props: TestDefinitionModel<ScopeRegistrationTestParams>,
) {

  return (
    <>
      <TestDefinition test={props} />
    </>
  );
}
