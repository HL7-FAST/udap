import { UdapClientStatus } from "./udap-client-status";
import { Stack } from "@mui/material";

export function ToolbarActions() {
  return (
    <Stack direction={'row'} spacing={2} alignItems={'center'}>
      <UdapClientStatus />
    </Stack>
  )
}