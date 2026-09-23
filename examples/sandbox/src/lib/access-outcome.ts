"use server";

import { UdapTransport, routeRequest, udapFetch } from "./udap-transport";

export type AccessRunOutcome = { status: number; body: unknown; url: string };

/** Reads a Patient bundle with the bearer token, reporting the routed URL so the page can show the proxy in use. */
export async function readPatientForOutcome(
  fhirServer: string,
  accessToken: string,
  transport?: UdapTransport,
): Promise<AccessRunOutcome> {
  const url = fhirServer.replace(/\/$/, "") + "/Patient?_count=1";
  const response = await udapFetch(
    url,
    { headers: { Authorization: "Bearer " + accessToken, Accept: "application/fhir+json" } },
    transport,
  );
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Body was not JSON, keep the raw text.
  }
  return { status: response.status, body, url: routeRequest(url, transport).url };
}
