"use client";

import { Box, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { Science } from "@mui/icons-material";
import { useState } from "react";
import React from "react";
import ScopesSupportedTest, { getScopesSupportedTest } from "./scopes-supported";
import ScopeRegistrationTest, { getScopeRegistrationTest } from "./scope-registration";
import { TestSuiteParams, getTestSuite } from "@/lib/tests/test-suite";
import TestSuite from "@/components/tests/test-suite";
import PageHeader from "@/components/page-header";
import { useCurrentFhirServer } from "@/lib/states";
import { formatMarkdownDescription } from "@/lib/utils";

export interface ScopeNegotiationTestSuiteParams extends TestSuiteParams {
  fhirServer: string;
}

export default function ScopesPage() {
  // The field starts out following the selected client's server and detaches once the user edits it.
  const [fhirServerOverride, setFhirServer] = useState<string | null>(null);
  const currentFhirServer = useCurrentFhirServer((state) => state.currentFhirServer);
  const fhirServer = fhirServerOverride ?? currentFhirServer;

  const supportedScopesTest = getScopesSupportedTest({
    fhirServer: fhirServer,
  });
  const scopeRegistrationTest = getScopeRegistrationTest({
    fhirServer: fhirServer,
  });

  const tests = [
    {
      component: ScopesSupportedTest(supportedScopesTest),
      model: supportedScopesTest,
    },
    {
      component: ScopeRegistrationTest(scopeRegistrationTest),
      model: scopeRegistrationTest,
    },
  ].map((t) => {
    t.model.params.suiteKey = "scope-negotiation";
    return t;
  });

  const suiteKey = "scope-negotiation";

  const params: ScopeNegotiationTestSuiteParams = {
    suiteKey,
    fhirServer,
  };

  const testSuite = getTestSuite<ScopeNegotiationTestSuiteParams>(
    suiteKey,
    "Scope Negotiation",
    formatMarkdownDescription(`
      This contains tests for scope negotiation based on the
      [guidelines](https://build.fhir.org/ig/HL7/fhir-udap-security-ig/general.html#scope-negotiation)
      in the implementation guide.
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
            label="FHIR Server"
            value={fhirServer}
            onChange={(e) => setFhirServer(e.target.value)}
            fullWidth
            helperText="Base URL of the FHIR server whose UDAP metadata the tests query"
          />
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader icon={<Science />} title="Scope Negotiation Tests" tag="Testing" color="success" />
      <TestSuite suite={testSuite} setup={setup} />
    </Box>
  );
}
