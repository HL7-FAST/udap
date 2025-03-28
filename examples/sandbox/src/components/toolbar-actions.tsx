"use client";
// import { ThemeSwitcher } from "@toolpad/core";
import { Stack } from "@mui/material";
import UdapClientStatus from "./udap-client-status";

export default function ToolbarActions() {
  return (
    <Stack direction={"row"} spacing={2} alignItems={"center"}>
      <UdapClientStatus />
    </Stack>
  );
}
