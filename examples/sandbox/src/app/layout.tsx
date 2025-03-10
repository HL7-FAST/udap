import type { Metadata } from "next";
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import React from "react";
import { Branding, Navigation } from "@toolpad/core";
import { Dashboard, Search, ThumbsUpDown } from '@mui/icons-material';
import { LinearProgress } from "@mui/material";
import { NextAppProvider } from "@toolpad/core/nextjs";
import theme from '../theme';

export const metadata: Metadata = {
  title: "FAST Security Sandbox",
  description: "Various examples and tests for FAST Security",
};


const NAVIGATION: Navigation = [
  {
    title: 'Dashboard',
    icon: <Dashboard />,
  },
  {
    segment: 'query',
    title: 'Query Server',
    icon: <Search />,
  },
  {
    segment: 'scopes',
    title: 'Scope Negotiation',
    icon: <ThumbsUpDown />,
  },
];

const BRANDING: Branding = {
  title: "FAST Security Sandbox",
  logo: "",
};

export default function RootLayout(props: { children: React.ReactNode }) {

  return (
    <html lang="en" data-toolpad-color-scheme="light" suppressHydrationWarning>
      <body>
      <AppRouterCacheProvider options={{ enableCssLayer: true }}>
        <React.Suspense fallback={<LinearProgress />}>
          <NextAppProvider navigation={NAVIGATION} branding={BRANDING} theme={theme}>
            {props.children}
          </NextAppProvider>
        </React.Suspense>
      </AppRouterCacheProvider>
      </body>
    </html>
  );
}
