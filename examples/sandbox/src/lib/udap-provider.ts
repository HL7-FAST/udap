import { OAuthConfig, OAuthUserConfig } from "next-auth/providers";
import { UdapProfile } from "./models";

export default function UdapProvider(
  options: OAuthUserConfig<UdapProfile>,
): OAuthConfig<UdapProfile> {
  return {
    id: "udap",
    name: "UDAP",
    type: "oidc",
    // The security server requires PKCE (SSRAA v2.0) and a state parameter.
    // Auth.js creates the challenge and cookies here; the custom /api/auth/callback/udap
    // route reads them back because it handles the token exchange itself.
    checks: ["pkce", "state"],

    // these will be provided later after running discovery against the resource server
    // issuer: 'https://localhost:5001',
    // authorization: 'https://localhost:5001/connect/authorize',
    // token: 'https://localhost:5001/connect/token',
    // userinfo: 'https://localhost:5001/connect/userinfo',

    options,
  };
}
