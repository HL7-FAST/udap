import TestDefinition from "@/components/tests/test-definition";
import { UdapClientRequest, UdapMetadata } from "@/lib/models";
import TestDefinitionModel, {
  BeforeTestOutcome,
  TestDefinitionParams,
  getTestDefinition,
} from "@/lib/tests/test-definition";
import { getNewStep, getOverallResultStatus, TestResult } from "@/lib/tests/test-result";
import { getCurrentTestSessionParam } from "@/lib/tests/test-store";
import { discoverUdapEndpoint, registerClient } from "@/lib/udap-actions";
import { formatMarkdownDescription, getAppBaseUrl } from "@/lib/utils";

export interface ScopeRegistrationTestParams extends TestDefinitionParams {
  fhirServer: string;
  udapWellknown?: UdapMetadata|undefined;
  fhirServerScopes?: string[];
  authServerScopes?: string[];
}


export function getScopeRegistrationTest(
  params: ScopeRegistrationTestParams,
): TestDefinitionModel<ScopeRegistrationTestParams> {

  return {
    ...getTestDefinition<ScopeRegistrationTestParams>(
      "scope-registration",
      "Scope Registration",
      formatMarkdownDescription(`Attempts to register a client with different scope secnarios based on the server's supported scopes.`),
      params,
    ),

    /**
     * Ensure that the UDAP discovery metadata is available for the registration tests.
     */
    async before(): Promise<BeforeTestOutcome> {

      // Already have the UDAP discovery metadata as a parameter
      if (params.udapWellknown) {
        params.udapWellknown = params.udapWellknown;
      }

      // Check if it's available in test session data
      if (!params.udapWellknown) {
        const sessionParam = getCurrentTestSessionParam("udapWellknown");
        if (sessionParam) {
          params.udapWellknown = sessionParam as UdapMetadata;
        }
      }

      // Check if it's available from the server
      if (!params.udapWellknown && params.fhirServer) {
        // Get the UDAP discovery metadata
        const udapWellknown = await discoverUdapEndpoint(params.fhirServer);
        if (udapWellknown) {
          params.udapWellknown = udapWellknown;
        }
      }

      // No UDAP discovery metadata available
      if (!params.udapWellknown) {
        return { success: false, isFatal: true, message: "Could not load a UDAP well-known metadata." };
      }

      // Ensure we have a registration endpoint 
      if (!params.udapWellknown.registration_endpoint) {
        return { success: false, isFatal: true, message: "No registration endpoint found in UDAP well-known metadata." };
      }

      // Determine if FHIR server is using a different server for auth and fetch that auth server's scopes
      params.fhirServerScopes = params.udapWellknown.scopes_supported;
      const fhirOrigin = new URL(params.fhirServer).origin;
      const authOrigin = new URL(params.udapWellknown.authorization_endpoint).origin;
      if (fhirOrigin !== authOrigin) {
        const authWellknown = await discoverUdapEndpoint(authOrigin);
        if (authWellknown && authWellknown.scopes_supported) {
          params.authServerScopes = authWellknown.scopes_supported;
        }
      }

      return { success: true };
    },

    async execute(): Promise<TestResult|undefined> {

      const result: TestResult = {
        id: crypto.randomUUID(),
        status: "unknown",
        params: params,
        dateStarted: new Date(),
        messages: [],
        steps: [],
      };

      
      let step = getNewStep(
        "compare-scopes",
        "Compare Scopes",
        "Compare the scopes supported by the FHIR server and the auth server.",
        "info"
      );
      result.steps = [step];
      
      const missingInAuth = (params.fhirServerScopes||[]).filter(scope => !params.authServerScopes?.includes(scope));
      const missingInFhir = (params.authServerScopes||[]).filter(scope => !params.fhirServerScopes?.includes(scope));
      if (missingInAuth.length > 0) {
        step.message = `Supported by the FHIR server but not the auth server: [${missingInAuth.join(", ").replace("*","\*")}] `;
      }
      if (missingInFhir.length > 0) {
        step.message += `Supported by the auth server but not the FHIR server: [${missingInFhir.join(", ").replace("*","\*")}]`;
      }
      const scopesAreSame = missingInAuth.length === 0 && missingInFhir.length === 0;
      if (scopesAreSame) {
        step.message = "The scopes supported by the FHIR server and the auth server are the same.";
      }
      step.dateCompleted = new Date();


      // Check if the server supports wildcard scopes
      const wildcardScopes = (params.fhirServerScopes || []).filter((scope: string) => scope.includes("/*"));

      const hostUrl = getAppBaseUrl();
      const clientReq: UdapClientRequest = {
        fhirServer: params.fhirServer,
        grantTypes: ["authorization_code"],
        issuer: hostUrl,
        clientName: "Scope Test Client",
        contacts: ["mailto:tester@localhost"],
        scopes: [],
        redirectUris: [hostUrl + "api/auth/callback/udap"],
      }


      /**
       * 
       * STEP: Request fewer scopes than the FHIR server advertises
       * 
       */
      step = getNewStep(
        "request-fewer-scopes",
        "Request Fewer Scopes",
        "Attempt to register a client with fewer scopes than the server supports.",
      );
      result.steps.push(step);

      // attempt to remove patient, user, and system scopes until at least one is removed
      let scopes = [...(params.fhirServerScopes || [])];
      const size = scopes.length;
      scopes = scopes.filter(scope => !scope.match(/^patient\//i));
      if (scopes.length === size) {
        scopes = scopes.filter(scope => !scope.match(/^user\//i));
        if (scopes.length === size) {
          scopes = scopes.filter(scope => !scope.match(/^system\//i));
        }
      }
      // still the same size... skip the test
      if (scopes.length === size) {
        step.result = "skip";
        step.message = "No patient, user, or system scopes found to remove. Skipping test.";
      } 
      // Otherwise run the registration test
      else {

        const wildcardsRequested = scopes.filter(scope => scope.includes("/*"));
        clientReq.scopes = scopes;

        console.log("Original server scopes:", params.fhirServerScopes);
        console.log("Registering client with scopes: ", clientReq.scopes);

        try {
          const request = await fetch("/api/client/register", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(clientReq)
          });

          if (request.ok) {

            const regRes = await request.json();

            console.log("Client registered successfully with scopes: ", clientReq.scopes);

            // scopes should have been returned in the response... fail otherwise
            if (!("scopes" in regRes)) {
              step.result = "fail";
              step.message = "Client registered successfully but no scopes were returned.";
            } 

            // scopes should be an array... fail otherwise
            else if (!(regRes.scopes instanceof Array)) {
              step.result = "fail";
              step.message = "Client registered successfully but scopes were not the expected array type.";
            }
            
            // compare returned scopes to the requested scopes
            else {
              const returnedScopes = regRes.scopes as string[];
              const missingScopes = scopes.filter(scope => !returnedScopes.includes(scope));

              console.log("Wildcards requested: ", wildcardsRequested);

              step.output = regRes;
              
              step.result = "pass";
              step.message = "Client registered successfully with fewer scopes than the server supports.";
              
            }
          } else {
            step.result = "fail";
            step.message = `Failed to register client: ${request.statusText}`;
          }

        } catch (error: unknown) {
          step.result = "fail";
          step.message = `Failed to register client: ${(error as Error).message}`;
        }

        console.log("Test step result:", step);

      }
      step.dateCompleted = new Date();



      /**
       * 
       * STEP: Request more scopes than the FHIR server advertises
       * 
       */
      step = getNewStep(
        "request-more-scopes",
        "Request More Scopes",
        "Attempt to register a client with more scopes than the server supports.",
      );
      result.steps.push(step);

      // attempt to add scopes that are likely not supported until we've added something
      scopes = [...(params.fhirServerScopes || [])];
      const newScopes = ["launch", "launch/patient", "launch/user", "launch/system"];
      for (const newScope of newScopes) {
        if (!scopes.includes(newScope)) {
          scopes.push(newScope);
          break;
        }
      }
      // still the same size... skip the test
      if (scopes.length === size) {
        step.result = "skip";
        step.message = "No new scopes found to add. Skipping test";
      }

      step.result = "fail";
      step.message = "Test not implemented yet.";
      step.dateCompleted = new Date();

      
      result.status = getOverallResultStatus(result);
      result.dateCompleted = new Date();
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
