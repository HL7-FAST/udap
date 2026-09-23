import { describe, expect, test } from "bun:test";
import { routeRequest } from "./udap-transport";

const FHIR = "https://fhir.example.org/fhir";

describe("routeRequest", () => {
  test("returns the url unchanged with no transport", () => {
    expect(routeRequest("https://as.example.org/connect/register")).toEqual({
      url: "https://as.example.org/connect/register",
      headers: {},
    });
  });

  test("sends a request under the FHIR server to the resource server proxy and keeps the path", () => {
    const r = routeRequest(FHIR + "/.well-known/udap", {
      fhirServer: FHIR,
      resourceServerProxy: "https://touchstone.aegis.net:61052",
      headers: { USER_KEY: "k1" },
    });
    expect(r.url).toBe("https://touchstone.aegis.net:61052/fhir/.well-known/udap");
    expect(r.headers).toEqual({ USER_KEY: "k1" });
  });

  test("sends any other request to the authorization server proxy and keeps the query", () => {
    const r = routeRequest("https://as.example.org/connect/token?x=1", {
      fhirServer: FHIR,
      authorizationServerProxy: "https://touchstone.aegis.net:55339/",
      headers: { ORG_KEY: "o1" },
    });
    expect(r.url).toBe("https://touchstone.aegis.net:55339/connect/token?x=1");
    expect(r.headers).toEqual({ ORG_KEY: "o1" });
  });

  test("sends multiple custom headers on a proxied request", () => {
    const r = routeRequest(FHIR + "/.well-known/udap", {
      fhirServer: FHIR,
      resourceServerProxy: "https://touchstone.aegis.net:61052",
      headers: { USER_KEY: "k1", "X-Test-Run": "42" },
    });
    expect(r.headers).toEqual({ USER_KEY: "k1", "X-Test-Run": "42" });
  });

  test("uses a proxy path as a prefix", () => {
    const r = routeRequest(FHIR + "/Patient", {
      fhirServer: FHIR,
      resourceServerProxy: "https://proxy.example.org/rs",
    });
    expect(r.url).toBe("https://proxy.example.org/rs/fhir/Patient");
  });

  test("sends the custom headers to the origin when no proxy applies", () => {
    const r = routeRequest("https://as.example.org/connect/register", {
      fhirServer: FHIR,
      resourceServerProxy: "https://touchstone.aegis.net:61052",
      headers: { USER_KEY: "k1" },
    });
    expect(r.url).toBe("https://as.example.org/connect/register");
    expect(r.headers).toEqual({ USER_KEY: "k1" });
  });

  test("sends the custom headers with no proxy configured", () => {
    const r = routeRequest(FHIR + "/Patient", { fhirServer: FHIR, headers: { "X-Test-Run": "42" } });
    expect(r.url).toBe(FHIR + "/Patient");
    expect(r.headers).toEqual({ "X-Test-Run": "42" });
  });

  test("does not treat a longer host as under the FHIR server", () => {
    const r = routeRequest("https://fhir.example.org/fhir-other/x", {
      fhirServer: FHIR,
      resourceServerProxy: "https://touchstone.aegis.net:61052",
      authorizationServerProxy: "https://touchstone.aegis.net:55339",
    });
    expect(r.url).toBe("https://touchstone.aegis.net:55339/fhir-other/x");
  });
});
