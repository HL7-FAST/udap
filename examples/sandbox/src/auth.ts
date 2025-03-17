import NextAuth, { NextAuthConfig } from "next-auth"
import "next-auth/jwt"
import UdapProvider from "./lib/udap-provider"
import { getDefaultClient } from "./lib/client-store"
import { UdapClient, UdapProfile } from "./lib/models";
import { OAuthUserConfig } from "next-auth/providers";


export async function getAuthConfig(): Promise<NextAuthConfig> {
  // console.log('Getting auth config...');
  
  let client: UdapClient | undefined;
  try {
    client = await getDefaultClient();
    // console.log('NextAuth client:', client);
  } catch (e) {
    console.log('NextAuth getDefaultClient error:', e);
  }
  

  if (!client) {
    return {
      providers: []
    }
  }

  //
  // TODO: Revisit internal CryptoKey issue
  // internal oauth4webapi PrivateKeyJwt needs a CryptoKey
  // Commenting all of this out for now because the instance of the key here becomes a regular Object and not a CryptoKey
  // by the time it is used.  This causes the instanceof check to fail.
  // So, we're implementing a workaround in the udap auth callback during the token step instead.
  // 
  // const cert = await getServerCertificate();
  // if (!cert) {
  //   throw new Error("No server certificate loaded");
  // }
  // const pk = await getPrivateKey(cert);
  // const pkPem = forge.pki.privateKeyToPem(pk!);
  // const keyObject = await createPrivateKey({key: pkPem, format: 'pem'});
  // const cryptoKey = await crypto.subtle.importKey(
  //   "pkcs8",
  //   keyObject.export({ format: "der", type: "pkcs8" }),
  //   { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  //   true,
  //   ["sign"]
  // );  


  const options: OAuthUserConfig<UdapProfile> = {
    clientId: client.id,
    client: {
      token_endpoint_auth_method: "private_key_jwt"
    },
    authorization: {
      url: client.authorization,
      params: {
        scope: client.scopes?.join(" "),
        redirect_uri: client.redirectUris ? client.redirectUris[0] : "",
      }
    },
    issuer: new URL(client.authorization).origin,
    token: {
      url: client.token,
      // clientPrivateKey: cryptoKey, // seems to become a regular Object so instanceof CryptoKey fails in oauth4webapi PrivateKeyJwt

      // TODO: Revisit if token request param overriding is working again (seems to be currently broken in nextjs beta)
    },
    userinfo: {
      url: client.userinfo
    }
  }

  // console.log('NextAuth options:', options);

  const authConfig: NextAuthConfig = {
    providers: [UdapProvider(options)],
    trustHost: true,
    callbacks: {
      // authorized({ request, auth }) {
      //   const { pathname } = request.nextUrl
      //   // if (pathname === "/middleware-example") return !!auth
      //   // return true
      //   console.log('NextAuth authorized:', pathname, auth);
      //   return !!auth
      // },
      async jwt({ token, trigger, session, account }) {
        // console.log('NextAuth jwt:', token, trigger, session, account);
        if (trigger === "update") {
          token.name = session.user.name;
        }
        return token;
      },
      session({ session, user, token }) {
        if (token?.accessToken) {
          session.accessToken = token.accessToken;
        }
        // console.log('NextAuth session:', session, user, token);
        return session;
      },
    },
    logger: {
      error: console.log,
      warn: console.log,
      debug: console.log
    },
    debug: true,
  };

  // console.log('NextAuth result:', authRes);

  return authConfig;
}

export const { handlers, signIn, signOut, auth } = NextAuth(async () => await getAuthConfig());



declare module "next-auth" {
  interface Session {
    accessToken?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
  }
}
