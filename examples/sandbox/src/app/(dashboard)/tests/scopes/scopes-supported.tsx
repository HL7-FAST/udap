import React from "react";
import {
  TestResult,
  getNewStep,
  getOverallResultStatus,
  handleError,
} from "@/lib/tests/test-result";
import TestDefinitionModel, {
  BeforeTestOutcome,
  TestDefinitionParams,
  getTestDefinition,
} from "@/lib/tests/test-definition";
import { formatMarkdownDescription } from "@/lib/utils";
import TestDefinition from "@/components/tests/test-definition";
import { setCurrentTestSessionParam } from "@/lib/tests/test-store";

export interface ScopesSupportedTestParams extends TestDefinitionParams {
  fhirServer: string;
}

export function getScopesSupportedTest(
  params: ScopesSupportedTestParams,
): TestDefinitionModel<ScopesSupportedTestParams> {
  return {
    ...getTestDefinition<ScopesSupportedTestParams>(
      "scopes-supported",
      "Scopes Supported",
      formatMarkdownDescription(`
    Queries the UDAP well-known endpoint to determine the scopes supported by the server.

    This checks the corresponding guidelines:

    - The \`scopes_supported\` metadata **SHALL** be present in the .well-known/udap object and **SHALL** list all scopes supported including all supported wildcard scopes. (1)
    - Client applications and servers **MAY** support wildcard scopes. (2)
  `),
      params,
    ),

    async before(): Promise<BeforeTestOutcome> {
      // fhirServer parameter is required
      if (!params || !params.fhirServer || params.fhirServer.trim() === "") {
        return {
          success: false,
          isFatal: true,
          message: "The parameter `fhirServer` is not set.  Test cannot proceed.",
        };
      }

      return { success: true };
    },

    async execute(): Promise<TestResult> {
      const result: TestResult = {
        id: crypto.randomUUID(),
        status: "unknown",
        params: params,
        dateStarted: new Date(),
        messages: [],
        steps: [],
      };

      // Fetch the UDAP well-known endpoint

      let step = getNewStep(
        "fetch-udap-well-known-endpoint",
        "Fetch UDAP Well-Known Endpoint",
        "Fetch the UDAP well-known endpoint to determine the scopes supported by the server.",
      );
      result.steps = [step];

      let udapMetadata: string | { scopes_supported: string[] } = "";
      try {
        const res = await fetch(params.fhirServer + "/.well-known/udap");
        udapMetadata = await res.json();
        step.output = udapMetadata;

        if (!res.ok) {
          step.result = "fail";
          step.message = `Failed to fetch UDAP well-known endpoint: ${res.status} ${res.statusText}`;
        } else {
          step.result = "pass";
          step.message = "Successfully fetched UDAP well-known endpoint.";
        }
      } catch (e) {
        step = handleError(step, e);
      }
      step.dateCompleted = new Date();

      // nothing else to check if no well-known was fetched
      if (step.result !== "pass") {
        result.status = "fail";
        return result;
      }

      // Validate the scopes_supported field is present
      step = getNewStep(
        "validate-scopes-supported-field",
        "Validate scopes_supported Field",
        "Ensure the `scopes_supported` field is present in the UDAP well-known endpoint.",
      );
      result.steps.push(step);
      let hasScopes = false;

      if (typeof udapMetadata === "object" && "scopes_supported" in udapMetadata) {
        if ((udapMetadata.scopes_supported || []).length > 0) {
          step.result = "pass";
          step.message =
            "The `scopes_supported` field is present in the UDAP well-known endpoint and contains at least one scope.";
          hasScopes = true;
        } else {
          step.result = "fail";
          step.message =
            "The `scopes_supported` field is present in the UDAP well-known endpoint but is empty.";
        }
      } else {
        step.result = "fail";
        step.message = "The scopes_supported field is missing from the UDAP well-known endpoint.";
      }
      step.dateCompleted = new Date();

      // Check if the scopes_supported field contains wildcard scopes
      step = getNewStep(
        "check-for-wildcard-scopes",
        "Check for Wildcard Scopes",
        formatMarkdownDescription(
          "Check if `the scopes_supported` field contains wildcard scopes.",
        ),
      );
      result.steps.push(step);

      if (hasScopes) {
        step.result = "info";
        const wildcardScopes = (
          (udapMetadata as { scopes_supported: string[] }).scopes_supported || []
        ).filter((scope: string) => scope.includes("/*"));
        if (wildcardScopes.length > 0) {
          step.output = wildcardScopes;
          step.message = "The scopes_supported field contains wildcard scopes.";
        } else {
          step.message = "The scopes_supported field does not contain any wildcard scopes.";
        }
      } else {
        step.result = "skip";
        step.message =
          "The scopes_supported field is missing from the UDAP well-known endpoint.  Test skipped.";
      }

      result.status = getOverallResultStatus(result);
      result.dateCompleted = new Date();
      return result;
    },

    async after(result: TestResult): Promise<BeforeTestOutcome> {
      // set the udap discovery document for other tests
      const udap = result.steps.find((s) => s.key === "fetch-udap-well-known-endpoint")?.output;
      if (udap) {
        setCurrentTestSessionParam("udapWellknown", udap);
      }

      return { success: true };
    },
  };
}

export default function ScopesSupportedTest(props: TestDefinitionModel<ScopesSupportedTestParams>) {
  return (
    <>
      <TestDefinition test={props} />
    </>
  );
}
