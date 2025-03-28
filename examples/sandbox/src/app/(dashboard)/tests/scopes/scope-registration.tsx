import TestDefinition from "@/components/tests/test-definition";
import { UdapClientRequest, UdapMetadata } from "@/lib/models";
import TestDefinitionModel, {
  BeforeTestOutcome,
  TestDefinitionParams,
  getTestDefinition,
} from "@/lib/tests/test-definition";
import { TestResult, getNewStep, getOverallResultStatus } from "@/lib/tests/test-result";
import { getCurrentTestSessionParam } from "@/lib/tests/test-store";
import { discoverUdapEndpoint } from "@/lib/udap-actions";
import { formatMarkdownDescription, getAppBaseUrl } from "@/lib/utils";

export interface ScopeRegistrationTestParams extends TestDefinitionParams {
  fhirServer: string;
  udapWellknown?: UdapMetadata | undefined;
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
      formatMarkdownDescription(
        `Attempts to register a client with different scope secnarios based on the server's supported scopes.`,
      ),
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
        return {
          success: false,
          isFatal: true,
          message: "Could not load a UDAP well-known metadata.",
        };
      }

      // Ensure we have a registration endpoint
      if (!params.udapWellknown.registration_endpoint) {
        return {
          success: false,
          isFatal: true,
          message: "No registration endpoint found in UDAP well-known metadata.",
        };
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

    async execute(): Promise<TestResult | undefined> {
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
        "info",
      );
      result.steps = [step];

      const missingInAuth = (params.fhirServerScopes || []).filter(
        (scope) => !params.authServerScopes?.includes(scope),
      );
      const missingInFhir = (params.authServerScopes || []).filter(
        (scope) => !params.fhirServerScopes?.includes(scope),
      );
      const scopesAreSame = missingInAuth.length === 0 && missingInFhir.length === 0;
      if (scopesAreSame) {
        step.message = "The scopes supported by the FHIR server and the auth server are the same.";
      } else {
        if (missingInAuth.length > 0) {
          step.message = formatMarkdownDescription(`
            Supported by the FHIR server but not the auth server: \`[${missingInAuth.join(", ")}]\`.
            `);
        }
        if (missingInFhir.length > 0) {
          if (step.message) {
            step.message += "\n\n";
          }
          step.message += formatMarkdownDescription(`
            Supported by the auth server but not the FHIR server: \`[${missingInFhir.join(", ")}]\`
            `);
        }
      }

      step.dateCompleted = new Date();

      // Check if the server supports wildcard scopes

      // Variables common to the next set of scopes tests
      const hostUrl = getAppBaseUrl();
      const clientReq: UdapClientRequest = {
        fhirServer: params.fhirServer,
        grantTypes: ["authorization_code"],
        issuer: hostUrl,
        clientName: "Scope Test Client",
        contacts: ["mailto:tester@localhost"],
        scopes: [],
        redirectUris: [hostUrl + "api/auth/callback/udap"],
      };

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
      scopes = scopes.filter((scope) => !scope.match(/^patient\//i));
      if (scopes.length === size) {
        scopes = scopes.filter((scope) => !scope.match(/^user\//i));
        if (scopes.length === size) {
          scopes = scopes.filter((scope) => !scope.match(/^system\//i));
        }
      }
      // still the same size... skip the test
      if (scopes.length === size) {
        step.result = "skip";
        step.message = "No patient, user, or system scopes found to remove. Skipping test.";
      }
      // Otherwise run the registration test
      else {
        clientReq.scopes = scopes;

        // console.log("Original server scopes:", params.fhirServerScopes);
        // console.log("Registering client with scopes: ", clientReq.scopes);
        step.input = clientReq;

        try {
          const request = await fetch("/api/client/register", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(clientReq),
          });

          if (request.ok) {
            const regRes = await request.json();
            step.output = regRes;

            // console.log("Client registered successfully with scopes: ", clientReq.scopes);

            // scopes should have been returned in the response... fail otherwise
            if (!("scopes" in regRes)) {
              step.result = "fail";
              step.message = "Client registered successfully but no scopes were returned.";
            }

            // scopes should be an array by now... fail otherwise
            else if (!(regRes.scopes instanceof Array)) {
              step.result = "fail";
              step.message = formatMarkdownDescription(`
                Client registered successfully but scope property was an unepected type.

                Scope property value: \`${JSON.stringify(regRes.scopes)}\`
                `);
            }

            // compare returned scopes to the requested scopes
            else {
              const returnedScopes = regRes.scopes as string[];

              step.output = regRes;

              step.result = "pass";
              step.message = formatMarkdownDescription(`
                Client registered successfully with fewer scopes than the server supports.

                FHIR server scopes supported: \`[${[...(params.fhirServerScopes || [])].join(", ")}]\`

                Requested scopes: \`[${scopes.join(", ")}]\`

                Returned scopes: \`[${returnedScopes.join(", ")}]\`
                `);
            }
          } else {
            step.result = "fail";
            step.message = `Failed to register client: ${request.statusText}`;
          }
        } catch (error: unknown) {
          step.result = "fail";
          step.message = `Failed to register client: ${(error as Error).message}`;
          step.output = error;
        }
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
      const newScopes = [
        "launch",
        "launch/patient",
        "launch/user",
        "launch/system",
        "launch/encounter",
        "observation/*.read",
        "encounter/*.read",
      ];
      const addScopesUntil = 2;
      let addScopesCount = 0;
      const scopesAdded: string[] = [];
      for (const newScope of newScopes) {
        if (!scopes.includes(newScope)) {
          scopes.push(newScope);
          scopesAdded.push(newScope);
          addScopesCount++;
          if (addScopesCount >= addScopesUntil) {
            break;
          }
        }
      }
      // still the same size... skip the test
      if (scopes.length === size) {
        step.result = "skip";
        step.message = "No new scopes found to add. Skipping test";
      }

      clientReq.scopes = scopes;
      step.input = clientReq;

      // attempt to register the client
      try {
        const request = await fetch("/api/client/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(clientReq),
        });

        if (request.ok) {
          const regRes = await request.json();
          step.output = regRes;

          // console.log("Client registered successfully with scopes: ", clientReq.scopes, regRes.scopes);

          // scopes should have been returned in the response... fail otherwise
          if (!("scopes" in regRes)) {
            step.result = "fail";
            step.message = "Client registered successfully but no scopes were returned.";
          }

          // scopes should be an array by now... fail otherwise
          else if (!(regRes.scopes instanceof Array)) {
            step.result = "fail";
            step.message = formatMarkdownDescription(`
              Client registered successfully but scope property was an unepected type.

              Scope property value: \`${JSON.stringify(regRes.scopes)}\`
              `);
          }

          // compare returned scopes to the requested scopes
          else {
            const returnedScopes = regRes.scopes as string[];
            step.output = regRes;

            if (returnedScopes.some((scope) => scopesAdded.includes(scope))) {
              step.result = "fail";
              step.message = formatMarkdownDescription(`
                Client registered successfully with more scopes than the server supports, but the added scopes were in the response and not dropped as expected.

                FHIR server scopes supported: \`[${[...(params.fhirServerScopes || [])].join(", ")}]\`

                Added scopes: \`[${scopesAdded.join(", ")}]\`

                Requested scopes: \`[${scopes.join(", ")}]\`

                Returned scopes: \`[${returnedScopes.join(", ")}]\`
                `);
            } else {
              step.result = "pass";
              step.message = formatMarkdownDescription(`
              Client registered successfully with while sending more scopes than the server supports and the added scopes were not in the response.

              FHIR server scopes supported: \`[${[...(params.fhirServerScopes || [])].join(", ")}]\`

              Added scopes: \`[${scopesAdded.join(", ")}]\`

              Requested scopes: \`[${scopes.join(", ")}]\`

              Returned scopes: \`[${returnedScopes.join(", ")}]\`
              `);
            }
          }
        } else {
          step.result = "fail";
          step.message = `Failed to register client: ${request.statusText}`;
        }
      } catch (error: unknown) {
        step.result = "fail";
        step.message = `Failed to register client: ${(error as Error).message}`;
        step.output = error;
      }

      /**
       * STEP: Request only invalid scopes
       */
      step = getNewStep(
        "request-only-invalid-scopes",
        "Request Only Invalid Scopes",
        "Attempt to register a client with only invalid scopes.  These are entirely fake scopes that should not be supported.",
      );
      result.steps.push(step);

      // attempt to add invalid scopes
      const invalidScopes = [
        "entirelymadeup",
        "notrealprofilescope",
        "fake/*.cruds",
        "imanadmin/trust.me",
      ];
      clientReq.scopes = invalidScopes;
      step.input = clientReq;

      // attempt to register the client
      try {
        const response = await fetch("/api/client/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(clientReq),
        });

        const regRes = await response.json();
        step.output = regRes;

        // Response may return a 200 or 201, but scopes should still be empty
        if (response.ok) {
          if ("scopes" in regRes) {
            if (regRes.scopes instanceof Array && regRes.scopes.length === 0) {
              step.result = "warn";
              step.message =
                "Client registered and returned no scopes in response, but expected invalid scopes to be rejected.  This may be acceptable.";
            } else if (regRes.scopes instanceof Array && regRes.scopes.length > 0) {
              step.result = "fail";
              step.message = formatMarkdownDescription(`
                Client registered successfully with invalid scopes.  Expected invalid scopes to be rejected.

                Requested scopes: \`[${invalidScopes.join(", ")}]\`

                Returned scopes: \`[${regRes.scopes.join(", ")}]\`
                `);
            } else {
              step.result = "fail";
              step.message = formatMarkdownDescription(`
                Client registered successfully but scope property was an unepected type.

                Scope property value: \`${JSON.stringify(regRes.scopes)}\`
                `);
            }
          }
        }

        // response not ok, and that is expected for this test but still need to check the actual response
        else {
          // expected response is a 400 with an invalid_client_metadata error
          if (
            response.status === 400 &&
            "error" in regRes &&
            regRes.error === "invalid_client_metadata"
          ) {
            step.result = "pass";
            step.message = formatMarkdownDescription(`
              Client registration failed as expected with 400 response and \`invalid_client_metadata\` error.
              `);
          }

          // unexpected response
          else {
            step.result = "fail";
            step.message = formatMarkdownDescription(`
              Client registration failed with unexpected response.

              Expected response: 400, Actual response: ${response.status}

              Response body: \`${JSON.stringify(regRes)}\`
              `);
          }
        }
      } catch (error: unknown) {
        step.result = "fail";
        step.message = `Failed to register client: ${(error as Error).message}`;
        step.output = error;
      }

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
