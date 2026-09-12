"use client";
import * as React from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useColorScheme, useTheme } from "@mui/material/styles";
import {
  Checklist,
  Code,
  DarkMode,
  Dashboard,
  LightMode,
  Menu as MenuIcon,
  Person,
  Science,
  Shield,
  Storage,
  VerifiedUser,
} from "@mui/icons-material";
import AccountStatus from "./account-status";
import UdapClientStatus from "./udap-client-status";

const DRAWER_WIDTH = 260;

type NavItem =
  | { kind: "header"; title: string }
  | { kind?: "link"; segment: string; title: string; icon: React.ReactNode };

const NAVIGATION: NavItem[] = [
  { segment: "", title: "Dashboard", icon: <Dashboard /> },
  { kind: "header", title: "Authorization Code Flow" },
  { segment: "fhir", title: "All Resources", icon: <Storage /> },
  { segment: "fhir/Patient", title: "Patients", icon: <Person /> },
  { kind: "header", title: "Client Credentials Flow" },
  { segment: "query", title: "Query", icon: <Code /> },
  { kind: "header", title: "Testing" },
  { segment: "tests/scopes", title: "Scope Negotiation", icon: <Science /> },
  { segment: "tests/certificates", title: "Certificate Validation", icon: <VerifiedUser /> },
  { segment: "tests/walkthrough", title: "Scenario Walkthrough", icon: <Checklist /> },
];

function activeSegment(pathname: string): string | undefined {
  const candidates = NAVIGATION.flatMap((item) => ("segment" in item ? [item.segment] : []));
  const matches = candidates.filter(
    (segment) => pathname === `/${segment}` || (segment && pathname.startsWith(`/${segment}/`)),
  );
  // Longest match wins so "/fhir/Patient" highlights Patients, not All Resources.
  return matches.sort((a, b) => b.length - a.length)[0];
}

function ColorModeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const resolved = mode === "system" ? systemMode : mode;
  if (!resolved) {
    return null;
  }
  return (
    <Tooltip title={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
      <IconButton color="inherit" onClick={() => setMode(resolved === "dark" ? "light" : "dark")}>
        {resolved === "dark" ? <LightMode /> : <DarkMode />}
      </IconButton>
    </Tooltip>
  );
}

export default function AppShell(props: { children: React.ReactNode }) {
  const pathname = usePathname();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const active = activeSegment(pathname);

  const drawerContent = (
    <>
      <Toolbar />
      <List sx={{ px: 1 }}>
        {NAVIGATION.map((item, i) =>
          item.kind === "header" ? (
            <ListSubheader key={i} disableSticky>
              {item.title}
            </ListSubheader>
          ) : (
            <ListItemButton
              key={i}
              component={NextLink}
              href={`/${item.segment}`}
              selected={item.segment === active}
              onClick={() => setMobileOpen(false)}
              sx={{ mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.title} />
            </ListItemButton>
          ),
        )}
      </List>
    </>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          {!isDesktop && (
            <IconButton edge="start" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
              <MenuIcon />
            </IconButton>
          )}
          <Stack
            direction="row"
            spacing={1}
            component={NextLink}
            href="/"
            sx={{ alignItems: "center", color: "inherit", textDecoration: "none", mr: "auto" }}
          >
            <Shield sx={{ fontSize: 32, color: "primary.main" }} />
            <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
              FAST Security
            </Typography>
          </Stack>
          {isDesktop && <UdapClientStatus />}
          <ColorModeToggle />
          <AccountStatus />
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isDesktop ? "permanent" : "temporary"}
          open={isDesktop || mobileOpen}
          onClose={() => setMobileOpen(false)}
          slotProps={{ paper: { sx: { width: DRAWER_WIDTH } } }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, bgcolor: "background.default" }}>
        <Toolbar />
        {!isDesktop && (
          <Box sx={{ px: 3, pt: 2 }}>
            <UdapClientStatus />
          </Box>
        )}
        {props.children}
      </Box>
    </Box>
  );
}
