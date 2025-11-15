import * as React from "react";
import { DashboardLayout } from "@toolpad/core/DashboardLayout";
import { PageContainer } from "@toolpad/core/PageContainer";
import AccountStatus from "@/components/account-status";
import ToolbarActions from "@/components/toolbar-actions";

export default async function DashboardPagesLayout(props: { children: React.ReactNode }) {
  return (
    <DashboardLayout
      slots={{
        toolbarAccount: AccountStatus,
        toolbarActions: ToolbarActions,
      }}
      sx={{
        "& .MuiDrawer-paper": {
          borderRight: "none",
          boxShadow: "0 0 20px rgba(0, 0, 0, 0.05)",
        },
      }}
    >
      <PageContainer sx={{ bgcolor: "background.default" }}>{props.children}</PageContainer>
    </DashboardLayout>
  );
}
