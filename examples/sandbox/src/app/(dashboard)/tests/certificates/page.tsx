"use client";

import { Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { VerifiedUser } from "@mui/icons-material";
import React, { useEffect, useState } from "react";
import CertificateScenarioTest, { getCertificateScenarioTest } from "./certificate-scenario";
import PageHeader from "@/components/page-header";
import TestSuite from "@/components/tests/test-suite";
import { BASE_PATH } from "@/lib/constants";
import { useUdapClientState } from "@/lib/states";
import { TestSuiteParams, getTestSuite } from "@/lib/tests/test-suite";
import { CertScenarioSummary } from "@/lib/tests/trust-outcome";
import { formatMarkdownDescription } from "@/lib/utils";

export interface CertificateValidationTestSuiteParams extends TestSuiteParams {
  serverUrl: string;
}

const SUITE_KEY = "certificate-validation";
const DEFAULT_SERVER_URL = "https://localhost:5001";

export default function CertificatesPage() {
  const client = useUdapClientState((state) => state.client);
  const initialServerUrl = client
    ? new URL(client.authorizationEndpoint).origin
    : DEFAULT_SERVER_URL;

  // The draft follows the text field. The server URL only changes when the user commits it,
  // so the catalog is not refetched on every keystroke.
  const [draft, setDraft] = useState(initialServerUrl);
  const [serverUrl, setServerUrl] = useState(initialServerUrl);
  const [scenarios, setScenarios] = useState<CertScenarioSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  // The cleanup aborts a superseded catalog request so a late response cannot overwrite
  // a newer one (from a fast server-URL change or a repeat reload of the same URL).
  useEffect(() => {
    const controller = new AbortController();
    fetch(BASE_PATH + "/api/tests/certificates?serverUrl=" + encodeURIComponent(serverUrl), {
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = await response.json();
        if (controller.signal.aborted) {
          return;
        }
        if (!response.ok) {
          throw new Error(json.error ?? json.message ?? response.statusText);
        }
        setScenarios(json as CertScenarioSummary[]);
      })
      .catch((e) => {
        if (controller.signal.aborted) {
          return;
        }
        setScenarios([]);
        setLoadError(e instanceof Error ? e.message : "Unknown error");
      });
    return () => controller.abort();
  }, [serverUrl, reloadCount]);

  const commitServerUrl = () => {
    const url = draft.trim();
    setScenarios([]);
    setLoadError(null);
    if (url === serverUrl) {
      setReloadCount((count) => count + 1);
    } else {
      setServerUrl(url);
    }
  };

  const tests = scenarios.map((scenario) => {
    const model = getCertificateScenarioTest({ suiteKey: SUITE_KEY, serverUrl, scenario });
    return { component: CertificateScenarioTest(model), model };
  });

  const params: CertificateValidationTestSuiteParams = { suiteKey: SUITE_KEY, serverUrl };

  const testSuite = getTestSuite<CertificateValidationTestSuiteParams>(
    SUITE_KEY,
    "Certificate Validation",
    formatMarkdownDescription(`
      Each test asks the FAST Security RI for a deliberately flawed client certificate
      (\`POST /api/cert/generate\` with a \`scenario\`), registers with it, and checks that the
      server accepts or rejects the registration the way its own catalog
      (\`GET /api/cert/scenarios\`) says it should. Titles, explanations, and conformance quotes
      come from that catalog. All certificates use RSA keys.
      `),
    tests,
    params,
  );

  const setup = (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
          Test Setup
        </Typography>
        <Stack direction="column" spacing={2}>
          <TextField
            label="UDAP server"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitServerUrl}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitServerUrl();
              }
            }}
            fullWidth
            helperText="Base URL of the FAST Security RI that issues the certificates and handles registration"
          />
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Button variant="outlined" onClick={commitServerUrl}>
              Reload scenarios
            </Button>
            <Typography variant="body2" color={loadError ? "error" : "text.secondary"}>
              {loadError ?? `${scenarios.length} scenarios loaded`}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader icon={<VerifiedUser />} title="Certificate Validation Tests" tag="Testing" color="success" />
      <TestSuite suite={testSuite} setup={setup} />
    </Box>
  );
}
