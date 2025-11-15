"use client";

import { Alert, Box, Card, CardContent, Chip, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Typography } from "@mui/material";
import { Storage } from "@mui/icons-material";
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
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Storage color="primary" />
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            FHIR Resources
          </Typography>
          <Chip label="Authorization Code" color="primary" size="small" />
        </Box>
        <Typography variant="body1" color="text.secondary">
          Browse and manage FHIR resources using the authorization code flow
        </Typography>
      </Box>

      {resourceTypes.length > 0 ? (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
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
