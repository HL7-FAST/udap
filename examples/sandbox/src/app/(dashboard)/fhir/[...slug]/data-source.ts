import { Bundle, BundleEntry, HumanName, OperationOutcome } from "fhir/r4";
import { Session } from "next-auth";
import { FhirResult } from "@/lib/models";

export function displayName(name: HumanName[] | undefined): string {
  if (!name || name.length < 1) return "";
  return `${name[0].given?.join(" ") ?? ""} ${name[0].family ?? ""}`.trim();
}

function authHeaders(session: Session | null): HeadersInit {
  return session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

/** Throws the parsed OperationOutcome (or an Error) so the page can render it. */
async function fetchFhir(url: string, session: Session | null): Promise<unknown> {
  const res = await fetch(url, { headers: authHeaders(session) });
  const isJson = /json/.test(res.headers.get("content-type") ?? "");
  if (!res.ok) {
    if (isJson) {
      throw (await res.json()) as OperationOutcome;
    }
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return res.json();
}

export async function fetchMany(
  fhirServer: string,
  resourceType: string,
  session: Session | null,
): Promise<{ items: FhirResult[]; total?: number }> {
  const bundle = (await fetchFhir(`${fhirServer}/${resourceType}`, session)) as Bundle;
  return {
    items: (bundle.entry ?? []).map((e: BundleEntry) => e.resource as FhirResult),
    total: bundle.total,
  };
}

export async function fetchOne(
  fhirServer: string,
  resourceType: string,
  id: string,
  session: Session | null,
): Promise<FhirResult> {
  return (await fetchFhir(`${fhirServer}/${resourceType}/${id}`, session)) as FhirResult;
}
