"use server";

import { Client } from "fhir-kit-client";
import { CapabilityStatement } from "fhir/r4";

/** Runs on the server so the FHIR server only has to be reachable from there, not from the browser. */
export async function getServerCapabilityStatement(fhirServer: string): Promise<CapabilityStatement> {
  const client = new Client({ baseUrl: fhirServer });
  const cs = await client.capabilityStatement();
  if (cs.resourceType !== "CapabilityStatement") {
    console.error("Did not receive a CapabilityStatement. Received:", cs);
    throw new Error("FHIR server did not return a CapabilityStatement.");
  }
  return structuredClone(cs) as unknown as CapabilityStatement;
}
