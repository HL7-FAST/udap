"use server";

import { P12Certificate, UdapClient, UdapClientRequest, UdapMetadata } from "./models";
import { TrustRunOutcome } from "./tests/trust-outcome";
import { registerClient } from "./udap-actions";
import { UdapTransport } from "./udap-transport";

/** Registers a client and turns a rejection into a TrustRunOutcome instead of a thrown error. Any other failure rethrows. */
export async function registerForOutcome(
  regReq: UdapClientRequest,
  cert: P12Certificate,
  transport?: UdapTransport,
  metadata?: UdapMetadata,
): Promise<TrustRunOutcome> {
  try {
    const client: UdapClient = await registerClient(regReq, cert, transport, metadata);
    return { outcome: "accepted", body: client };
  } catch (e) {
    const cause = e instanceof Error ? e.cause : undefined;
    const rejected =
      cause && typeof cause === "object" && "status" in cause && "body" in cause
        ? (cause as { status: unknown; body: unknown })
        : undefined;
    if (!rejected || typeof rejected.status !== "number") {
      throw e;
    }
    return { outcome: "rejected", status: rejected.status, body: rejected.body };
  }
}
