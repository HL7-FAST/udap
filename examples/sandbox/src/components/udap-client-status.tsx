"use client"
import { useAvailableFhirServers, useCurrentFhirServer, useUdapClientState } from "@/lib/states";
import { Alert, MenuItem, Select, Stack } from "@mui/material";


export default function UdapClientStatus() {

  const { client } = useUdapClientState((state) => state);
  const { currentFhirServer, setCurrentFhirServer } = useCurrentFhirServer((state) => state);
  const { fhirServers } = useAvailableFhirServers((state) => state);


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