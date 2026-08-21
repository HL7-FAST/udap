"use client";
import { Box, Card, CardActionArea, CardContent, Chip, Grid, Stack, Typography } from "@mui/material";
import { AccountCircle, Science, VpnKey } from "@mui/icons-material";
import NextLink from "next/link";
import { ReactNode } from "react";
import { FlowColor } from "@/components/page-header";

interface FlowCard {
  title: string;
  tag: string;
  color: FlowColor;
  icon: ReactNode;
  description: string;
  links: { label: string; href: string }[];
}

const FLOWS: FlowCard[] = [
  {
    title: "Authorization Code Flow",
    tag: "User-level",
    color: "primary",
    icon: <AccountCircle />,
    description:
      "Test user-level access with the authorization code grant type. This flow requires user authentication and is ideal for applications that need to act on behalf of a user.",
    links: [
      { label: "All Resources", href: "/fhir" },
      { label: "Patients", href: "/fhir/Patient" },
    ],
  },
  {
    title: "Client Credentials Flow",
    tag: "System-level",
    color: "secondary",
    icon: <VpnKey />,
    description:
      "Test system-level access with the client credentials grant type. This flow enables server-to-server authentication without user interaction.",
    links: [{ label: "Query", href: "/query" }],
  },
  {
    title: "Scope Negotiation Tests",
    tag: "Testing",
    color: "success",
    icon: <Science />,
    description:
      "Explore how different scopes are handled and negotiated during the authentication process. Test various scope combinations and see how the system responds.",
    links: [{ label: "Scope Negotiation", href: "/tests/scopes" }],
  },
];

export default function DashboardPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          FAST Security Sandbox
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Test and explore UDAP authentication flows in a sandbox environment
        </Typography>
      </Stack>

      <Grid container spacing={3}>
        {FLOWS.map((flow) => (
          <Grid key={flow.title} size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: "100%" }}>
              <CardActionArea component={NextLink} href={flow.links[0].href} sx={{ height: "100%" }}>
                <CardContent>
                  <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2 }}>
                    <Box
                      sx={{
                        display: "flex",
                        p: 1.25,
                        borderRadius: 2,
                        color: `${flow.color}.main`,
                        bgcolor: `rgba(var(--mui-palette-${flow.color}-mainChannel) / 0.12)`,
                        "& svg": { fontSize: 28 },
                      }}
                    >
                      {flow.icon}
                    </Box>
                    <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
                      <Typography variant="h6" component="h2">
                        {flow.title}
                      </Typography>
                      <Chip label={flow.tag} size="small" color={flow.color} variant="outlined" />
                    </Stack>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {flow.description}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: `${flow.color}.main` }}>
                    {flow.links.map((l) => l.label).join(" · ")}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
