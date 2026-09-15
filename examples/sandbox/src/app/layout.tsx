import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline, InitColorSchemeScript } from "@mui/material";
import { SessionProvider } from "next-auth/react";
import React from "react";
import theme from "../theme";
import ZustandProvider from "@/components/zustand-provider";
import { auth } from "@/auth";
import { BASE_PATH } from "@/lib/constants";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "FAST Security Sandbox",
  description: "Various examples and tests for FAST Security",
};

export default async function RootLayout(props: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <InitColorSchemeScript attribute="data" defaultMode="system" />
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <ThemeProvider theme={theme} defaultMode="system">
            <CssBaseline enableColorScheme />
            <SessionProvider session={session} basePath={BASE_PATH + "/api/auth"}>
              <ZustandProvider>{props.children}</ZustandProvider>
            </SessionProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
