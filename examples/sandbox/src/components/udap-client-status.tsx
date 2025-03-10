import { getDefaultClient } from "@/lib/client-store";
import { UdapClient } from "@/lib/models";
import { Alert, Badge } from "@mui/material";
import { useEffect, useState } from "react";


export function UdapClientStatus() {

  const [client, setClient] = useState<UdapClient>();

  useEffect(() => {
    setClient(undefined);
    async function fetchData() {
      const client = await getDefaultClient();
      setClient(client);
    }
    fetchData();
  }, []);

  return (
  
    <>
      {
        client ?
        <Alert severity="success" color={'success'}>
          Client: {client.name} <Badge>{client.fhirServer}</Badge>
        </Alert>
        :
        <Alert severity="error"  color={'error'}>No client loaded.</Alert>        
      }        
    </>
    
  )
}