import * as React from "react";
import { DashboardLayout } from "@toolpad/core/DashboardLayout";
import { PageContainer } from "@toolpad/core/PageContainer";
import { create } from "zustand/react";
import AccountStatus from "@/components/account-status";
import ToolbarActions from "@/components/toolbar-actions";

export interface AvailableResourceTypes {
  resourceTypes: string[];
  setResourceTypes: (resourceTypes: string[]) => void;
}

export const useAvailableResourceTypes = create<AvailableResourceTypes>((set) => ({
  resourceTypes: [],
  setResourceTypes: (resourceTypes) => {
    set({ resourceTypes });
  },
}));

export default async function DashboardPagesLayout(props: { children: React.ReactNode }) {
  return (
    <DashboardLayout
      slots={{
        toolbarAccount: AccountStatus,
        toolbarActions: ToolbarActions,
      }}
    >
      <PageContainer>{props.children}</PageContainer>
    </DashboardLayout>
  );
}
