import { OAuthConfig, OAuthUserConfig } from "next-auth/providers";
import { UdapProfile } from "./models";


export default function UdapProvider(options: OAuthUserConfig<UdapProfile>): OAuthConfig<UdapProfile> {
    
  return {
    id: 'udap',
    name: 'UDAP',
    type: 'oidc',
    checks: ['none'],

    // TODO: implement PKCE code verifier check
    // checks: ["pkce"],

    // these will be provided later after running discovery against the resource server
    // issuer: 'https://localhost:5001', 
    // authorization: 'https://localhost:5001/connect/authorize',
    // token: 'https://localhost:5001/connect/token',
    // userinfo: 'https://localhost:5001/connect/userinfo',

    options
  }
}