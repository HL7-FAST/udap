"use server";

import { AccessCheckKey, accessRequests } from "./tests/access-judge";
import { UdapTransport, routeRequest, udapFetch } from "./udap-transport";

export type AccessRunOutcome = { key: AccessCheckKey; label: string; status: number; body: unknown; url: string };

/**
 * Sends each access check with the bearer token, one after the other, so a capture proxy records them in list order.
 * Reports the routed URL of each check so the page can show the proxy in use.
 */
export async function runAccessChecks(
  fhirServer: string,
  accessToken: string,
  patientId: string | undefined,
  transport?: UdapTransport,
): Promise<AccessRunOutcome[]> {
  const base = fhirServer.replace(/\/$/, "");
  const outcomes: AccessRunOutcome[] = [];
  for (const check of accessRequests(patientId)) {
    const url = base + "/" + check.path;
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
    outcomes.push({ key: check.key, label: check.label, status: response.status, body, url: routeRequest(url, transport).url });
  }
  return outcomes;
}
