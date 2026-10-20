"use server";

export async function getDefaultFhirServer(): Promise<string> {
  console.log(
    "getDefaultFhirServer() :: Getting default FHIR server URL...",
    process.env.FHIR_SERVER_URL,
  );
  return process.env.FHIR_SERVER_URL ?? "http://localhost:8080/fhir";
}

export interface DefaultServers {
  fhirServer: string;
  securityServer: string;
}

/** Defaults for the test pages. The embedded sandbox gets both from the IdP, standalone runs fall back to local dev URLs. */
export async function getDefaultServers(): Promise<DefaultServers> {
  return {
    fhirServer: process.env.FHIR_SERVER_URL ?? "http://localhost:8080/fhir",
    securityServer: process.env.SECURITY_SERVER_URL ?? "https://localhost:5001",
  };
}
