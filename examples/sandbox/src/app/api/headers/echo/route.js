import { headers } from "next/headers";

// simple echo of headers
export async function GET() {
  const headerList = await headers();
  const ret = []
  headerList.forEach((value, key) => {
    // console.log(`Header: ${key} - Value: ${value}`);
    ret.push({ key, value });
  });
  return Response.json(ret);
}