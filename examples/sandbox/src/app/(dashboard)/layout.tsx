import * as React from "react";
import AppShell from "@/components/app-shell";

export default function DashboardPagesLayout(props: { children: React.ReactNode }) {
  return <AppShell>{props.children}</AppShell>;
}
