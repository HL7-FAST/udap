"use client";

import { Alert, Box, Card, CardContent, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Typography } from "@mui/material";
import { Storage } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useAvailableResourceTypes } from "@/lib/states";
import PageHeader from "@/components/page-header";

export default function FhirQueryPage() {
  const resourceTypes = useAvailableResourceTypes((state) => state.resourceTypes);

  const router = useRouter();
  const handleChange = (event: SelectChangeEvent) => {
    const selectedResourceType = event.target.value as string;
    router.push(`/fhir/${selectedResourceType}`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        icon={<Storage />}
        title="FHIR Resources"
        tag="Authorization Code"
        description="Browse and manage FHIR resources using the authorization code flow"
      />

      {resourceTypes.length > 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
              Select Resource Type
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose a FHIR resource type from the list below to view and interact with resources.
            </Typography>
            <FormControl fullWidth>
              <InputLabel id="resource-type-select-label">Resource Type</InputLabel>
              <Select
                labelId="resource-type-select-label"
                id="resource-type-select"
                value=""
                label="Resource Type"
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
          </CardContent>
        </Card>
      ) : (
        <Alert severity="warning">
          No resource types found in server CapabilityStatement.
        </Alert>
      )}
    </Box>
  );
}
