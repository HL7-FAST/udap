import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import React from "react";
import { Branding, Navigation } from "@toolpad/core";
import { Code, Dashboard, Person, Science, Shield, Storage } from "@mui/icons-material";
import { LinearProgress } from "@mui/material";
import { NextAppProvider } from "@toolpad/core/nextjs";
import { SessionProvider } from "next-auth/react";
import theme from "../theme";
import ZustandProvider from "@/components/zustand-provider";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "FAST Security Sandbox",
  description: "Various examples and tests for FAST Security",
};

const NAVIGATION: Navigation = [
  {
    segment: "",
    title: "Dashboard",
    icon: <Dashboard />,
  },
  {
    title: "Authorization Code Flow",
    kind: "header",
  },
  {
    segment: "fhir",
    title: "All Resources",
    icon: <Storage />,
  },
  {
    segment: "fhir/Patient",
    title: "Patients",
    icon: <Person />,
  },
  {
    title: "Client Credentials Flow",
    kind: "header",
  },
  {
    segment: "query",
    title: "Query",
    icon: <Code />,
  },
  {
    title: "Testing",
    kind: "header",
  },
  {
    segment: "tests/scopes",
    title: "Scope Negotiation",
    icon: <Science />,
  },
];

const BRANDING: Branding = {
  title: "FAST Security",
  logo: <Shield sx={{ fontSize: 32, color: "primary.main" }} />,
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
                <NextAppProvider
                  navigation={NAVIGATION}
                  branding={BRANDING}
                  theme={theme}
                  session={session}
                >
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
