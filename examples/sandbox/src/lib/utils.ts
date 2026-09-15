import { UdapClient } from "./models";
import { BASE_PATH } from "./constants";
export function formatMarkdownDescription(input: string, leadingSpacesToRemove?: number): string {
  leadingSpacesToRemove ??= input.split("\n").reduce((acc, line) => {
      if (line.trim().length === 0) {
        return acc;
      }
      const leadingSpaces = /^ +/.exec(line);
      if (leadingSpaces) {
        return Math.min(acc, leadingSpaces[0].length);
      }
      return acc;
    }, Infinity);
  return input.trim().replace(new RegExp(`^ {${leadingSpacesToRemove}}`, "gm"), "");
}

export function getAppBaseUrl(): string {
  let hostUrl = process.env.APP_URL;

  try {
    if (hostUrl) {
      return hostUrl;
    } else {
      hostUrl = window.location.origin + BASE_PATH;
    }
  } catch {
    hostUrl = "http://localhost:3000/";
  }

  return hostUrl.endsWith("/") ? hostUrl : hostUrl + "/";
}

/**
 * Scopes to request at the token or authorize endpoint. Use the compact scopes we
 * registered with (wildcards) rather than the server's expanded grant list, but drop
 * any that the server silently declined at registration.
 */
export function tokenRequestScopes(client: UdapClient): string[] {
  const granted = client.scopes ?? [];
  const requested = (client.requestedScopes ?? []).filter((s) => granted.includes(s));
  return requested.length > 0 ? requested : granted;
}
