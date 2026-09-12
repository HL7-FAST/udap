import TestDefinition from "@/components/tests/test-definition";
import { judgeCertificateShape } from "@/lib/tests/cert-facts";
import TestDefinitionModel, {
  TestDefinitionParams,
  getTestDefinition,
} from "@/lib/tests/test-definition";
import {
  TestResult,
  getNewStep,
  getOverallResultStatus,
  handleError,
} from "@/lib/tests/test-result";
import {
  CertScenarioSummary,
  TrustRunResponse,
  judgeTrustOutcome,
} from "@/lib/tests/trust-outcome";

export interface CertificateScenarioTestParams extends TestDefinitionParams {
  serverUrl: string;
  scenario: CertScenarioSummary;
}

/** Card text comes from the server's catalog: summary, expectation, and the conformance quotes. */
function describeScenario(scenario: CertScenarioSummary): string {
  const expectation =
    scenario.expected === "accepted"
      ? "Expected: registration **accepted**."
      : `Expected: registration **rejected** with error \`${scenario.expectedError}\`.`;
  const references = scenario.references
    .map((r) => `- [${r.shortLabel}](${r.url}): ${r.quote}`)
    .join("\n");
  return `${scenario.summary}\n\n${expectation}\n\n${references}`;
}

export function getCertificateScenarioTest(
  params: CertificateScenarioTestParams,
): TestDefinitionModel<CertificateScenarioTestParams> {
  return {
    ...getTestDefinition<CertificateScenarioTestParams>(
      `certificate-${params.scenario.key}`,
      params.scenario.title,
      describeScenario(params.scenario),
      params,
    ),

    async execute(): Promise<TestResult | undefined> {
      const result: TestResult = {
        id: crypto.randomUUID(),
        status: "unknown",
        params,
        dateStarted: new Date(),
        messages: [],
        steps: [],
      };

      const inspectStep = getNewStep(
        "inspect-certificate",
        "Inspect certificate",
        `Ask the server for a \`${params.scenario.key}\` certificate and check that it has the shape the scenario claims.`,
      );
      const registerStep = getNewStep(
        "register",
        "Register",
        "Register with the certificate and compare the outcome with the catalog.",
      );
      result.steps = [inspectStep, registerStep];

      // One SAN per scenario keeps the registered clients apart on the server.
      const request = {
        serverUrl: params.serverUrl,
        scenario: params.scenario.key,
        altName: `${window.location.origin}/tests/certificates/${params.scenario.key}`,
      };
      inspectStep.input = request;
      registerStep.input = request;

      try {
        const response = await fetch("/api/tests/certificates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        const json = await response.json();

        if (!response.ok) {
          inspectStep.output = json;
          inspectStep.result = "fail";
          inspectStep.message = `The sandbox could not run the scenario: ${json.error ?? json.message ?? response.statusText}`;
          registerStep.result = "skip";
          registerStep.message = "Skipped because the certificate could not be inspected.";
        } else {
          const { certificate, registration, registrationError } = json as TrustRunResponse;

          inspectStep.output = certificate;
          const shapeJudgement = judgeCertificateShape(params.scenario.key, certificate, new Date());
          inspectStep.result = shapeJudgement.result;
          inspectStep.message = shapeJudgement.message;

          if (registration) {
            registerStep.output = registration;
            const outcomeJudgement = judgeTrustOutcome(params.scenario, registration);
            registerStep.result = outcomeJudgement.result;
            registerStep.message = outcomeJudgement.message;
          } else {
            registerStep.output = registrationError;
            registerStep.result = "fail";
            registerStep.message = `Registration could not complete: ${registrationError}`;
          }
        }
      } catch (e) {
        handleError(inspectStep, e);
        registerStep.result = "skip";
        registerStep.message = "Skipped because the certificate could not be inspected.";
      }
      inspectStep.dateCompleted = new Date();
      registerStep.dateCompleted = new Date();

      result.status = getOverallResultStatus(result);
      result.dateCompleted = new Date();
      return result;
    },
  };
}

export default function CertificateScenarioTest(props: TestDefinitionModel<CertificateScenarioTestParams>) {
  return <TestDefinition test={props} />;
}
