import { auth } from "@/auth";
import { COOKIE_CURRENT_FHIR_SERVER } from "@/lib/constants";
import { getBadRequestResponse } from "@/lib/fhir";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import Client, { FhirResource } from "fhir-kit-client";



export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {

  const { slug } = await params;
  const cookieStore  = await cookies();
  const session = await auth();

  const fhirServer = cookieStore.get(COOKIE_CURRENT_FHIR_SERVER)?.value;

  if (!fhirServer) {
    return getBadRequestResponse("No FHIR server specified");
  }

  const client = new Client({baseUrl: fhirServer, bearerToken: session?.accessToken});

  // console.log('client:', client.customHeaders);

  let req: Promise<FhirResource>;

  if (slug.length === 2) {
    req = client.read({resourceType: slug[0], id: slug[1]});
  }
  else {
    req = client.search({resourceType: slug[0]});
  }

  try {
    const response = await req;
    return Response.json(response);
  }
  catch (e: unknown) {
    // console.error('Failed to load FHIR data:', e);
    if (e instanceof Error) {
      console.error('Failed to load FHIR data:', e.message);
    }

    if (typeof e === "object" && e !== null && "response" in e) {
      const error = e as { response: { data: object; status: number } };
      return Response.json(error.response.data, {status: error.response.status});
    }

    return new Response(JSON.stringify({}), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

}