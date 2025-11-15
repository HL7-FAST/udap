"use client";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import { CheckCircle, ErrorOutline, Person, Storage } from "@mui/icons-material";
import { useUdapClientState } from "@/lib/states";

export default function UdapClientStatus() {
  const { client } = useUdapClientState((state) => state);

  return (
    <>
      {client ? (
        <Stack 
          direction="row" 
          spacing={1.5} 
          alignItems="center" 
          sx={{ 
            px: 2, 
            py: 1, 
            borderRadius: 2,
            bgcolor: "success.main",
            color: "success.contrastText",
            "& .MuiSvgIcon-root": {
              fontSize: "1.25rem",
            },
          }}
        >
          <CheckCircle sx={{ fontSize: "1.25rem" }} />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Tooltip title="Client Name">
              <Chip 
                icon={<Person />}
                label={client.name}
                size="small"
                sx={{ 
                  bgcolor: "rgba(255, 255, 255, 0.2)",
                  color: "inherit",
                  "& .MuiChip-icon": {
                    color: "inherit",
                  },
                }}
              />
            </Tooltip>
            <Tooltip title="FHIR Server">
              <Chip 
                icon={<Storage />}
                label={client.fhirServer}
                size="small"
                sx={{ 
                  bgcolor: "rgba(255, 255, 255, 0.2)",
                  color: "inherit",
                  "& .MuiChip-icon": {
                    color: "inherit",
                  },
                }}
              />
            </Tooltip>
          </Box>
        </Stack>
      ) : (
        <Stack 
          direction="row" 
          spacing={1} 
          alignItems="center"
          sx={{ 
            px: 2, 
            py: 1, 
            borderRadius: 2,
            bgcolor: "error.main",
            color: "error.contrastText",
          }}
        >
          <ErrorOutline sx={{ fontSize: "1.25rem" }} />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            No client loaded
          </Typography>
        </Stack>
      )}
    </>
  );
}
