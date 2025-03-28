"use client";

import { Alert, FormControl, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { useRouter } from "next/navigation";
import { useAvailableResourceTypes } from "@/lib/states";

export default function FhirQueryPage() {
  const resourceTypes = useAvailableResourceTypes((state) => state.resourceTypes);

  const router = useRouter();
  const handleChange = (event: SelectChangeEvent) => {
    const selectedResourceType = event.target.value as string;
    router.push(`/fhir/${selectedResourceType}`);
  };

  return (
    <>
      {resourceTypes.length > 0 ? (
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
      ) : (
        <Alert severity="warning" color={"warning"}>
          No resource types found in server CapabilityStatement.
        </Alert>
      )}
    </>
  );
}
