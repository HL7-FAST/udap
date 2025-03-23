import type { Metadata } from "next";
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import React from "react";
import { Branding, Navigation } from "@toolpad/core";
import { Dashboard, Person, Search, ThumbsUpDown } from '@mui/icons-material';
import { LinearProgress } from "@mui/material";
import { NextAppProvider } from "@toolpad/core/nextjs";
import { SessionProvider } from "next-auth/react";
import theme from '../theme';
import ZustandProvider from "@/components/zustand-provider";
import { auth } from "@/auth";

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
    title: 'FHIR Operations',
    kind: 'header',
  },
  {
    segment: 'fhir',
    title: 'All Resources',
    icon: <Search />,
  },
  {
    segment: 'fhir/Patient',
    title: 'Patients',
    icon: <Person />,
  },
  {
    title: 'Tests',
    kind: 'header',
  },
  {
    segment: 'tests/scopes',
    title: 'Scope Negotiation',
    icon: <ThumbsUpDown />,
  },
];

const BRANDING: Branding = {
  title: "FAST Security Sandbox",
  logo: "",
};

export default async function RootLayout(props: { children: React.ReactNode }) {

  const session = await auth();

  return (
    <html lang="en" data-toolpad-color-scheme="light" suppressHydrationWarning>
      <body>
        <ZustandProvider>
          <SessionProvider session={session}>
            <AppRouterCacheProvider options={{ enableCssLayer: true }}>
              <React.Suspense fallback={<LinearProgress />}>
                <NextAppProvider navigation={NAVIGATION} branding={BRANDING} theme={theme} session={session}>
                  {props.children}
                </NextAppProvider>
              </React.Suspense>
            </AppRouterCacheProvider>
          </SessionProvider>
        </ZustandProvider>
      </body>
    </html>
  );
}
