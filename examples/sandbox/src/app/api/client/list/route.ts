import { getAllClients } from "@/lib/client-store";



export async function GET() {

  const clients = await getAllClients();

  return Response.json({
    clients
  });

}