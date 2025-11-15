"use client";
import { Alert, Stack } from "@mui/material";
import { useUdapClientState } from "@/lib/states";

export default function UdapClientStatus() {
  const { client } = useUdapClientState((state) => state);

  return (
    <>
      {client ? (
        <Stack direction={"row"} spacing={1} alignItems={"center"} justifyContent={"center"}>
          <div>Client: {client.name}</div>
          <div>Server: {client.fhirServer}</div>
        </Stack>
      ) : (
        <Alert severity="error" color={"error"}>
          No client loaded.
        </Alert>
      )}
    </>
  );
}
