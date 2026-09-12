import { NextResponse } from "next/server";

/** Normalizes a caller-supplied server URL to origin+pathname, so a query string or fragment can never reach the appended API path. Returns null if input is not a string or not a valid http(s) URL. */
export function normalizeServerUrl(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  return (url.origin + url.pathname).replace(/\/$/, "");
}

export function errorResponse(message: string, e: unknown, status: number): Response {
  return NextResponse.json(
    { status: "error", message, error: e instanceof Error ? e.message : "Unknown error" },
    { status },
  );
}
