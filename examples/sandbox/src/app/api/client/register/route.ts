import { NextRequest, NextResponse } from "next/server";
import { getServerCertificate } from "@/lib/cert-store";
import { UdapClientRequest } from "@/lib/models";
import { registerClient } from "@/lib/udap-actions";



/**
 * API route to handle registering a client.  Expects a JSON body matching UdapClientRequest
 */
export async function POST(request: NextRequest): Promise<Response> {

  try {
    const body: UdapClientRequest = await request.json();
    console.log("POST auth: ", body);

    const cert = await getServerCertificate();
    if (!cert) {
      throw new Error("No server certificate loaded");
    }
    const reqRes = await registerClient(body, cert);
    
    console.log("Client registered: ", reqRes);

    return NextResponse.json(reqRes, { status: 200 });

  } catch (e) {
    console.error("Failed to register client: ", e);
    return NextResponse.json({
      status: "error",
      message: "Failed to register client",
      error: e instanceof Error ? e.message : "Unknown error",
    }, { status: 500 });
  }

}
