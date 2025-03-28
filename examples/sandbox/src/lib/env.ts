"use server";

export async function getDefaultFhirServer(): Promise<string> {
  console.log(
    "getDefaultFhirServer() :: Getting default FHIR server URL...",
    process.env.FHIR_SERVER_URL,
  );
  return process.env.FHIR_SERVER_URL ?? "http://localhost:8080/fhir";
}
