import { X509Certificate } from "crypto";
import { Profile } from "next-auth";
import * as forge from "node-forge";
import { DataModel } from "@toolpad/core/Crud";
import { DomainResource } from "fhir/r4";

export type P12Certificate = forge.pkcs12.Pkcs12Pfx;

export interface UdapClientRequest {
  fhirServer: string;
  grantTypes: string[];
  issuer: string;
  clientName: string;
  contacts: string[];
  scopes: string[];
  redirectUris?: string[];
  logoUri?: string;
}

export interface UdapClient {
  id: string;
  name: string;
  iss: string;
  sub: string;
  aud: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string;
  fhirServer: string;
  redirectUris?: string[];
  responseTypes: string[];
  scopes: string[];
  grantType: "authorization_code" | "client_credentials";
}

export interface UdapMetadata {
  udap_versions_supported: ["1"];
  udap_profiles_supported: string[];
  udap_authorization_extensions_supported: string[];
  udap_authorization_extensions_required: string[];
  udap_certifications_supported: string[];
  udap_certifications_required: string[];
  grant_types_supported: Array<"authorization_code" | "refresh_token" | "client_credentials">;
  scopes_supported: string[];
  authorization_endpoint: string;
  token_endpoint: string;
  token_endpoint_auth_methods_supported: ["private_key_jwt"];
  token_endpoint_auth_signing_alg_values_supported: string[];
  registration_endpoint: string;
  registration_endpoint_jwt_signing_alg_values_supported: string[];
  signed_metadata: string;
  userinfo_endpoint: string;
}

export interface UdapX509Header {
  alg: "RS256" | "RS384";
  x5c: X509Certificate;
}

export interface UdapSoftwareStatement {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  jti: string;
  client_name: string;
  redirect_uris?: string[];
  contacts: string[];
  logo_uri?: string;
  grant_types: string[];
  response_types?: string[] | null;
  token_endpoint_auth_method: "private_key_jwt";
  scope: string;
}

export interface UdapRegistration {
  header: UdapX509Header;
  softwareStatement: UdapSoftwareStatement;
}

export interface UdapRegistrationRequest {
  /**
   * Signed JWT containing the software statement
   */
  software_statement: string;
  udap: "1";
}

export interface UdapRegistrationResponse {
  client_id: string;
  software_statement: string;
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  jti: string;
  client_name: string;
  redirect_uris: string[];
  logo_uri: string;
  contacts: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  scope: string;
}

export type UdapProfile = Profile;

// export interface FhirResult extends DataModel {
//   resource: DomainResource;
// }
export type FhirResult = DomainResource & DataModel;
