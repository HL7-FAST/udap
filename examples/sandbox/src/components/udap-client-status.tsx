"use client"
import { getDefaultClient } from "@/lib/client-store";
import { useAvailableFhirServers, useCurrentFhirServer, useUdapClientState } from "@/lib/states";
import { Alert, MenuItem, Select, Stack } from "@mui/material";
import { useEffect } from "react";


export default function UdapClientStatus() {

  const { client, setClient } = useUdapClientState((state) => state);
  const { currentFhirServer, setCurrentFhirServer } = useCurrentFhirServer((state) => state);
  const { fhirServers, setFhirServers } = useAvailableFhirServers((state) => state);


  // load default client
  useEffect(() => {
    setCurrentFhirServer("");
    setFhirServers([]);
    getDefaultClient().then((client) => setClient(client));
  }, [setClient, setCurrentFhirServer, setFhirServers]);

  // client change... refresh fhir servers and default to first
  useEffect(() => {
    setCurrentFhirServer("");
    setFhirServers([]);
    if (client && client.fhirServers && client.fhirServers.length > 0) {
      setCurrentFhirServer(client.fhirServers[0]);
      setFhirServers(client.fhirServers);
    }
  }, [client, setCurrentFhirServer, setFhirServers]);


  return (
  
    <>
      {
        client ?
        <Stack direction={'row'} spacing={1} alignItems={'center'} justifyContent={'center'}>
          <div>
            Client: {client.name}
          </div>
          {
            fhirServers && fhirServers.length > 0 ?
            <>
              <Select
                label="FHIR Server"
                variant="standard"
                value={currentFhirServer}
                onChange={(e) => {
                  setCurrentFhirServer(e.target.value);
                }}>
                  <MenuItem disabled value="">
                    <em>Select a FHIR Server</em>
                  </MenuItem>
                  {
                    (client.fhirServers || []).map((server, i) =>
                      <MenuItem key={i} value={server}>{server}</MenuItem>
                    )
                  }
              </Select>

              {/* {
                client.fhirServers.slice(0, maxBadges-1).map((server, i) =>
                  <Chip key={i} label={server} size="small" color="info"/>
                )
              }
              {
                client.fhirServers.length > maxBadges ? 
                <Chip key={maxBadges} label={`+${client.fhirServers.length - maxBadges}`} size="small" color="info" />
                : <></>
              } */}
            </>
            : <></>
          }
        </Stack>
        :
        <Alert severity="error"  color={'error'}>No client loaded.</Alert>        
      }        
    </>
    
  )
}