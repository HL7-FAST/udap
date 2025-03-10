'use client'

import * as React from 'react';
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
import { PageContainer } from '@toolpad/core/PageContainer';
import { ToolbarActions } from '../../components/toolbar-actions';

export default function Layout(props: { children: React.ReactNode }) {
  return (
    <DashboardLayout
      slots={{
        toolbarActions: ToolbarActions
      }}
    >
      <PageContainer>{props.children}</PageContainer>
    </DashboardLayout>
  );
}  
