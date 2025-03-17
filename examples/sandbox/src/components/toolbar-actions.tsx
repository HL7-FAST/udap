"use client"
// import { ThemeSwitcher } from "@toolpad/core";
import UdapClientStatus from "./udap-client-status";
import { Stack } from "@mui/material";

export default function ToolbarActions() {
  
  return (
    <Stack direction={'row'} spacing={2} alignItems={'center'}>
      <UdapClientStatus />
    </Stack>
  )
}