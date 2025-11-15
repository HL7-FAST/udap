import { NextRequest } from "next/server";
import Client, { FhirResource } from "fhir-kit-client";
import { CLIENT_CREDENTIALS_CLIENT_ID } from "@/lib/constants";
import { getInternalServerErrorResponse } from "@/lib/fhir";
import { getClient } from "@/lib/client-store";
import { getAccessToken } from "@/lib/udap-actions";

// async function getFhirServer(request: NextRequest): Promise<string | undefined> {
//   const cookieStore = await cookies();
//   let fhirServer = cookieStore.get(COOKIE_CURRENT_FHIR_SERVER)?.value;

//   const searchParams = new URLSearchParams(request.nextUrl.searchParams);

//   // query parameter overrides any possible cookie value
//   if (searchParams.has("server")) {
//     fhirServer = searchParams.get("server") ?? fhirServer;
//   }

//   return fhirServer;
// }

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  // const session = await auth();

  // const fhirServer = await getFhirServer(request);
  // console.log("fhirServer:", fhirServer);

  // if (!fhirServer) {
  //   return getBadRequestResponse("No FHIR server specified");
  // }

  // console.log("session:", session);

  // Using the default client_credentials client for server-to-server FHIR access
  const udapClient = await getClient(CLIENT_CREDENTIALS_CLIENT_ID);
  if (!udapClient) {
    return getInternalServerErrorResponse("No UDAP client available");
  }

  const tokenRes = await getAccessToken(udapClient);
  if (!tokenRes || !tokenRes.access_token) {
    return getInternalServerErrorResponse("Failed to obtain access token");
  }

  const fhirClient = new Client({ 
    baseUrl: udapClient.fhirServer,
    bearerToken: tokenRes.access_token,
  });

  let req: Promise<FhirResource>;

  if (slug.length === 2) {
    req = fhirClient.read({ resourceType: slug[0], id: slug[1] });
  } else {
    req = fhirClient.search({ resourceType: slug[0] });
  }

  try {
    const response = await req;
    return Response.json(response);
  } catch (e: unknown) {
    // console.error('Failed to load FHIR data:', e);
    if (e instanceof Error) {
      console.error("Failed to load FHIR data:", e.message);
    }

    if (typeof e === "object" && e !== null && "response" in e) {
      const error = e as { response: { data: object; status: number } };
      return Response.json(error.response.data, { status: error.response.status });
    }

    return new Response(JSON.stringify({}), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
