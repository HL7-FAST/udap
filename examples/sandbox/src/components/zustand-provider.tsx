"use client";
import { ReactNode, useEffect } from "react";
import { useCurrentFhirServer, useUdapClientState } from "@/lib/states";
import { getClient } from "@/lib/client-store";
import { AUTHORIZATION_CODE_CLIENT_ID } from "@/lib/constants";

export default function ZustandProvider(props: { children: ReactNode }) {
  const { client, setClient } = useUdapClientState((state) => state);
  const { setCurrentFhirServer } = useCurrentFhirServer((state) => state);

  // load default client
  useEffect(() => {
    // console.log('ZustandProvider: load default client', client);
    getClient(AUTHORIZATION_CODE_CLIENT_ID).then((client) => {
      if (!client) {
        throw new Error(`No UDAP client found with id "${AUTHORIZATION_CODE_CLIENT_ID}"`);
      }
      setClient(client);
    });
  }, [setClient]);

  // client change... refresh fhir servers and default to first
  useEffect(() => {
    // console.log('ZustandProvider: client change', client);
    setCurrentFhirServer("");
    if (client && client.fhirServer && client.fhirServer.length > 0) {
      setCurrentFhirServer(client.fhirServer);
    }
  }, [client, setCurrentFhirServer]);

  return <>{props.children}</>;
}
