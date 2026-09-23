/**
 * Routes UDAP requests through a forwarding test proxy such as AEGIS Touchstone. The proxy forwards to the
 * real server and passes bodies through untouched, so the client keeps signing for the discovered
 * endpoints and only sends the bytes to the proxy. Custom headers (for example Touchstone's USER_KEY)
 * go on every request, proxied or not, because some test platforms need them without a proxy.
 */
export interface UdapTransport {
  /** FHIR server URL. Requests under it go to resourceServerProxy, every other request goes to authorizationServerProxy. */
  fhirServer: string;
  resourceServerProxy?: string;
  authorizationServerProxy?: string;
  headers?: Record<string, string>;
}

function isUnder(url: URL, base: string): boolean {
  const b = new URL(base);
  const basePath = b.pathname.replace(/\/$/, "");
  return url.origin === b.origin && (url.pathname === basePath || url.pathname.startsWith(basePath + "/"));
}

export function routeRequest(url: string, transport?: UdapTransport): { url: string; headers: Record<string, string> } {
  if (!transport) {
    return { url, headers: {} };
  }
  const headers = { ...transport.headers };
  const target = new URL(url);
  const proxy = isUnder(target, transport.fhirServer) ? transport.resourceServerProxy : transport.authorizationServerProxy;
  if (!proxy) {
    return { url, headers };
  }
  return { url: proxy.replace(/\/$/, "") + target.pathname + target.search, headers };
}

export function udapFetch(url: string, init: RequestInit | undefined, transport?: UdapTransport): Promise<Response> {
  const routed = routeRequest(url, transport);
  return fetch(routed.url, { ...init, headers: { ...routed.headers, ...(init?.headers as Record<string, string> | undefined) } });
}
