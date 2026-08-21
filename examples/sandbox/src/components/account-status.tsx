"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import * as jose from "jose";

export default function AccountStatus() {
  const session = useSession();
  const authenticated = session?.status === "authenticated";

  const accessToken = authenticated ? session.data?.accessToken : undefined;
  const [expiredToken, setExpiredToken] = useState<string>();

  // Prompt at the moment the access token expires (immediately if it already has).
  useEffect(() => {
    if (!accessToken) return;
    const jwt = jose.decodeJwt(accessToken);
    if (!jwt.exp) return;
    const timer = setTimeout(
      () => setExpiredToken(accessToken),
      Math.max(0, jwt.exp * 1000 - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [accessToken]);

  const expiredPromptOpen = !!accessToken && expiredToken === accessToken;

  return (
    <>
      <Button
        variant={authenticated ? "outlined" : "contained"}
        onClick={() => (authenticated ? signOut() : signIn("udap"))}
      >
        {authenticated ? "Sign Out" : "Sign In"}
      </Button>

      <Dialog open={expiredPromptOpen}>
        <DialogTitle>Access Token Expired</DialogTitle>
        <DialogContent>
          <DialogContentText>Do you want to sign in again?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => signOut()}>Sign Out</Button>
          <Button variant="contained" onClick={() => signIn("udap")}>
            Sign In
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
