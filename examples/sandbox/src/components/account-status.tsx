"use client";

import { Button } from "@mui/material";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect } from "react";
import * as jose from "jose";
import { useDialogs } from "@toolpad/core";

export default function AccountStatus() {
  const session = useSession();
  const dialogs = useDialogs();

  useEffect(() => {
    // console.log('Session changed:', session, session.data?.expires);
    if (session?.data?.accessToken && session.status === "authenticated") {
      const jwt = jose.decodeJwt(session.data.accessToken);
      if (jwt.exp) {
        const expires = jwt.exp * 1000;
        if (expires < Date.now()) {
          // console.log('NextAuth jwt: token expired');
          const confirmed = dialogs.confirm("Do you want to sign in again?", {
            title: "Access Token Expired",
            okText: "Sign In",
            cancelText: "Sign Out",
          });
          confirmed.then((result) => {
            if (result) {
              signIn("udap");
            } else {
              signOut();
            }
          });
        }
      }
    }
  }, [dialogs, session]);

  return (
    <>
      {session && session.status === "authenticated" ? (
        <div>
          <Button variant="outlined" color="primary" onClick={() => signOut()}>
            Sign Out
          </Button>
        </div>
      ) : (
        <div>
          <Button variant="outlined" color="primary" onClick={() => signIn("udap")}>
            Sign In
          </Button>
        </div>
      )}
    </>
  );
}
