"use client";
import { Chip, Stack, Tooltip } from "@mui/material";
import { CheckCircle, ErrorOutlined, Storage } from "@mui/icons-material";
import { useUdapClientState } from "@/lib/states";

export default function UdapClientStatus() {
  const client = useUdapClientState((state) => state.client);

  if (!client) {
    return (
      <Chip
        variant="outlined"
        color="error"
        size="small"
        icon={<ErrorOutlined />}
        label="No client loaded"
      />
    );
  }

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
      <Tooltip title="Registered UDAP client">
        <Chip
          variant="outlined"
          color="success"
          size="small"
          icon={<CheckCircle />}
          label={client.name}
        />
      </Tooltip>
      <Tooltip title="FHIR server">
        <Chip variant="outlined" size="small" icon={<Storage />} label={client.fhirServer} />
      </Tooltip>
    </Stack>
  );
}
