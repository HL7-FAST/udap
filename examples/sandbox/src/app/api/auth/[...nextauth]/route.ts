import { getAuthConfig, handlers } from "@/auth"
import { getServerCertificate } from "@/lib/cert-store";
import { UdapProfile } from "@/lib/models";
import { discoverUdapEndpoint, getClientAssertion } from "@/lib/udap-actions";
import { OAuthConfig, OAuthUserConfig } from "next-auth/providers";
import { NextRequest } from "next/server";
import { encode } from "@auth/core/jwt";
import { serialize, SerializeOptions } from "cookie";


export async function GET(request: NextRequest): Promise<Response> {
  // console.log("GET auth: ", request.nextUrl.pathname, request.url);

  // only really supporting /udap but we can pretend...
  if (request.nextUrl.pathname !== "/api/auth/callback/udap") {
    return handlers.GET(request);
  }

  // console.log("GET auth:", request.url);
  const authConfig = (await getAuthConfig()).providers.find((p) => (p as OAuthConfig<UdapProfile>).id === "udap");
  
  if (!authConfig || !authConfig.options) {
    throw new Error("No UDAP provider configured");
  }
  const options: OAuthUserConfig<UdapProfile> = authConfig.options;

  const cookies = request.cookies;
  // console.log("GET auth cookies:", cookies);

  // console.log("GET auth options:", options);

  if (!options.issuer) {
    throw new Error("No issuer configured in provider");
  }
  if (!options.clientId) {
    throw new Error("No clientId configured");
  }
  const cert = await getServerCertificate();
  if (!cert) {
    throw new Error("No server certificate");
  }

  // ensure we have token and userinfo endpoints
  if (!options.token?.url || !options.userinfo?.url) {
    const wellKnown = await discoverUdapEndpoint(options.issuer);
    options.token ??= {};
    options.token.url ??= wellKnown.token_endpoint;
    options.userinfo ??= {};
    options.userinfo.url ??= wellKnown.userinfo_endpoint;
  }


  // TODO: implement PKCE code verifier check

  // const cookie = cookies.get("authjs.pkce.code_verifier");
  // if (!cookie) {
  //   throw new Error("No code verifier cookie");
  // }
  // const codeVerifier = cookie.value;

  const tokenParams = {
    grant_type: "authorization_code",
    code: request.nextUrl.searchParams.get("code") || "",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: await getClientAssertion(options.clientId, options.token.url, cert),
    redirect_uri: "http://localhost:3000/api/auth/callback/udap",
    // code_verifier: codeVerifier || "",
    udap: "1"
  }

  const tokenResponse = await fetch(options.token.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(tokenParams).toString()
  });

  const tokenJson = await tokenResponse.json();
  if (!tokenResponse.ok) {
    throw new Error(`Failed to get token: (${tokenResponse.status}) ${tokenJson.error}: ${tokenJson.error_description}`);
  }
  console.log("GET auth token:", tokenJson);

  // get user info 
  let userInfoJson;
  if (options.userinfo?.url && tokenJson.scope?.split(" ").includes("profile")) {
    const userInfoResponse = await fetch(options.userinfo.url, {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`
      }
    });

    userInfoJson = await userInfoResponse.json();
    if (!userInfoResponse.ok) {
      throw new Error(`Failed to get user info: (${userInfoResponse.status}) ${userInfoJson.error}: ${userInfoJson.error_description}`);
    }
    console.log("GET auth userinfo:", userInfoJson);

  }

  const token = {
    ...userInfoJson,
    accessToken: tokenJson.access_token
  }

  console.log("GET auth session token:", token);

  // Update the session with the new token
  const sessionToken = await encode({
    token,
    secret: process.env.AUTH_SECRET!,
    salt: "authjs.session-token",
    maxAge: tokenJson.expires_in || 3600
  });

  const sessionCookie = {
    name: "authjs.session-token",
    value: sessionToken,
    options: {
      httpOnly: true,
      secure: false, //process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: tokenJson.expires_in || 3600
    } satisfies SerializeOptions
  };

  
  let redirect = cookies.get("authjs.callback-url")?.value;
  if (!redirect) {
    redirect = process.env.APP_URL ?? "http://localhost:3000/";
  }
  console.log("GET auth redirect:", redirect);

  const responseHeaders = new Headers();

  const cookieHeader = serialize(sessionCookie.name, sessionCookie.value, sessionCookie.options);
  responseHeaders.set("Set-Cookie", cookieHeader);
  responseHeaders.set("Location", redirect);
  // const response = NextResponse.redirect(redirect, { headers: responseHeaders });
  const response: Response = new Response(undefined, { headers: responseHeaders, status: 302 });
  console.log("GET auth response:", response);

  return response;  
}

export async function POST(request: NextRequest): Promise<Response> {
  // console.log("POST auth: ", request);
  return handlers.POST(request)
}