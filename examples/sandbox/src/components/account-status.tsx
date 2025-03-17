"use client"

import { Button } from "@mui/material";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect } from "react";
import * as jose from "jose";

export default function AccountStatus() {

  const session = useSession();
  

  useEffect(() => {
    console.log('Session changed:', session, session.data?.expires);
    if (session?.data?.accessToken && session.status === "authenticated") {

      const jwt = jose.decodeJwt(session.data.accessToken);
      if (jwt.exp) {
        const expires = jwt.exp * 1000;
        if (expires < Date.now()) {
          console.log('NextAuth jwt: token expired');
          signIn("udap");
        }
      }
    }

  }, [session]);

  return (
    <>
      {
        session && session.status === "authenticated" ?
        <div>
          <Button variant="outlined" color="primary" onClick={() => signOut()}>Sign Out</Button>
        </div>
        :
        <div>
          <Button variant="outlined" color="primary" onClick={() => signIn("udap")}>Sign In</Button>
        </div>
      }
    </>
  )
}