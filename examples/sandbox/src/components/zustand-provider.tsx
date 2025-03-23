"use client"
import { ReactNode, useEffect } from 'react';
import { getDefaultClient } from '@/lib/client-store';
import { useAvailableFhirServers, useCurrentFhirServer, useUdapClientState } from '@/lib/states';

export default function ZustandProvider(props: { children: ReactNode }) {

  const {client, setClient} = useUdapClientState((state) => state);
  const { setCurrentFhirServer } = useCurrentFhirServer((state) => state);
  const { setFhirServers } = useAvailableFhirServers((state) => state);


  // load default client
  useEffect(() => {
    // console.log('ZustandProvider: load default client', client);
    getDefaultClient().then((client) => setClient(client));
  },[setClient]);

  // client change... refresh fhir servers and default to first
  useEffect(() => {
    // console.log('ZustandProvider: client change', client);
    setCurrentFhirServer("");
    setFhirServers([]);
    if (client && client.fhirServers && client.fhirServers.length > 0) {
      setCurrentFhirServer(client.fhirServers[0]);
      setFhirServers(client.fhirServers);
    }
  }, [client, setCurrentFhirServer, setFhirServers]);

  return (
    <>{props.children}</>
  );
}