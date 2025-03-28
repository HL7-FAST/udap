import { getBadRequestResponse } from "@/lib/fhir";

export async function GET() {
  return getBadRequestResponse("No resource type specified");
}
