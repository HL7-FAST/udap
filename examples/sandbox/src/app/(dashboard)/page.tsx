import * as React from "react";
import { Box, Card, CardContent, Chip, Link, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { AccountCircle, Science, VpnKey } from "@mui/icons-material";
import NextLink from "next/link";

export default function DashboardPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
          FAST Security Sandbox
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Test and explore UDAP authentication flows in a sandbox environment
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card 
            sx={{ 
              height: "100%",
              transition: "all 0.3s ease",
              "&:hover": { 
                transform: "translateY(-4px)",
                boxShadow: 6,
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Box
                  sx={{
                    bgcolor: "primary.main",
                    color: "white",
                    borderRadius: 2,
                    p: 1.5,
                    display: "flex",
                    mr: 2,
                  }}
                >
                  <AccountCircle fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Authorization Code Flow
                  </Typography>
                  <Chip label="User-level" size="small" color="primary" sx={{ mt: 0.5 }} />
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Test user-level access with the authorization code grant type. This flow requires
                user authentication and is ideal for applications that need to act on behalf of a user.
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Test on:{" "}
                <Link component={NextLink} href="/fhir" sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                  All Resources
                </Link>
                {" • "}
                <Link component={NextLink} href="/fhir/Patient" sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                  Patients
                </Link>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card 
            sx={{ 
              height: "100%",
              transition: "all 0.3s ease",
              "&:hover": { 
                transform: "translateY(-4px)",
                boxShadow: 6,
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Box
                  sx={{
                    bgcolor: "secondary.main",
                    color: "white",
                    borderRadius: 2,
                    p: 1.5,
                    display: "flex",
                    mr: 2,
                  }}
                >
                  <VpnKey fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Client Credentials Flow
                  </Typography>
                  <Chip label="System-level" size="small" color="secondary" sx={{ mt: 0.5 }} />
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Test system-level access with the client credentials grant type. This flow enables
                server-to-server authentication without user interaction.
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Test on:{" "}
                <Link component={NextLink} href="/query" sx={{ color: "secondary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                  Query
                </Link>
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card 
            sx={{ 
              transition: "all 0.3s ease",
              "&:hover": { 
                transform: "translateY(-4px)",
                boxShadow: 6,
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Box
                  sx={{
                    bgcolor: "success.main",
                    color: "white",
                    borderRadius: 2,
                    p: 1.5,
                    display: "flex",
                    mr: 2,
                  }}
                >
                  <Science fontSize="large" />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Scope Negotiation Tests
                  </Typography>
                  <Chip label="Testing" size="small" color="success" sx={{ mt: 0.5 }} />
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Explore how different scopes are handled and negotiated during the authentication process.
                Test various scope combinations and see how the system responds.
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Test on:{" "}
                <Link component={NextLink} href="/tests/scopes" sx={{ color: "success.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                  Scope Negotiation
                </Link>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
