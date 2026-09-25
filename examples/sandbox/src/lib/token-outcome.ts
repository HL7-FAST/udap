"use server";

import jwt from "jsonwebtoken";
import { P12Certificate, UdapClient } from "./models";
import { getAccessToken } from "./udap-actions";
import { UdapTransport } from "./udap-transport";

export type TokenRunOutcome =
  | { outcome: "issued"; accessToken: string; claims: Record<string, unknown> }
  | { outcome: "rejected"; status: number; body: unknown };

export interface AuthorizationCodeGrant {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

/**
 * Requests a token signed with an explicit certificate and turns a rejection into a TokenRunOutcome.
 * Any other failure rethrows. `grant` carries the authorization code leg for authorization_code clients.
 */
export async function requestTokenForOutcome(
  client: UdapClient,
  cert: P12Certificate,
  transport?: UdapTransport,
  grant?: AuthorizationCodeGrant,
): Promise<TokenRunOutcome> {
  try {
    const token = await getAccessToken(client, grant?.code, grant?.redirectUri, grant?.codeVerifier, cert, transport);
    let claims: Record<string, unknown> = {};
    if (token.access_token) {
      const decoded = jwt.decode(token.access_token);
      if (decoded && typeof decoded === "object") {
        claims = decoded as Record<string, unknown>;
      }
    }
    return { outcome: "issued", accessToken: token.access_token ?? "", claims };
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
