"use client"

import { useCurrentFhirServer } from "@/lib/states";
import { useEffect, useState } from "react";
import Client, { FhirResource } from "fhir-kit-client";
import { CapabilityStatement } from "fhir/r4";
import { Alert, SelectChangeEvent } from "@mui/material";
import { MenuItem, Select, FormControl } from "@mui/material";
import { useRouter } from "next/navigation";


export default function FhirQueryPage() {

  const fhirServer = useCurrentFhirServer((state) => state.currentFhirServer);
  const [resourceTypes, setResourceTypes] = useState<string[]>([]);

  useEffect(() => {

    setResourceTypes([]);

    if (!fhirServer) {
      return;
    }

    const client = new Client({ baseUrl: fhirServer });
    client.capabilityStatement().then((cs: FhirResource) => {
      if (cs.resourceType !== 'CapabilityStatement') {
        console.error("Did not receive a CapabilityStatement.  Received:", cs);
      }
      const types = (cs as CapabilityStatement).rest?.[0].resource?.map((r) => r.type);
      setResourceTypes(types || []);
    });

  },[fhirServer]);


  const router = useRouter();
  const handleChange = (event: SelectChangeEvent) => {
    const selectedResourceType = event.target.value as string;
    router.push(`/fhir/${selectedResourceType}`);
  };

  
  return (
    <>
      {
        resourceTypes.length > 0 ?
        <div>

          <FormControl fullWidth>
            <Select
              labelId="resource-type-select-label"
              id="resource-type-select"
              value=""
              onChange={handleChange}
            >
              <MenuItem disabled value="">
                <em>Select a resource type</em>
              </MenuItem>
              {resourceTypes.map((type, index) => (
                <MenuItem key={index} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
        </div>
        :
        <Alert severity="warning" color={'warning'}>No resource types found in server CapabilityStatement.</Alert>
      }
    </>
  );
}