"use client";

import { Box, Card, CardContent, Chip, Stack, TextField, Typography } from "@mui/material";
import { Science } from "@mui/icons-material";
import { useEffect, useState } from "react";
import React from "react";
import ScopesSupportedTest, { getScopesSupportedTest } from "./scopes-supported";
import ScopeRegistrationTest, { getScopeRegistrationTest } from "./scope-registration";
import { TestSuiteParams, getTestSuite } from "@/lib/tests/test-suite";
import TestSuite from "@/components/tests/test-suite";
import { useCurrentFhirServer } from "@/lib/states";
import { formatMarkdownDescription } from "@/lib/utils";

export interface ScopeNegotiationTestSuiteParams extends TestSuiteParams {
  fhirServer: string;
}

export default function ScopesPage() {
  const [fhirServer, setFhirServer] = useState<string>("");

  const currentFhirServer = useCurrentFhirServer((state) => state.currentFhirServer);

  useEffect(() => {
    if (!fhirServer) {
      setFhirServer(currentFhirServer);
    }
  }, [currentFhirServer, fhirServer, setFhirServer]);

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
      <a href="https://build.fhir.org/ig/HL7/fhir-udap-security-ig/general.html#scope-negotiation" target="_blank" rel="noopener">guidelines</a>
      in the implementation guide.
      `),
    tests,
    params,
  );

  const setup = (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Test Setup
        </Typography>
        <Stack direction="column" spacing={2}>
          <TextField
            label="FHIR Server"
            value={fhirServer}
            onChange={(e) => setFhirServer(e.target.value)}
            fullWidth
            variant="outlined"
          />
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Science color="success" />
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Scope Negotiation Tests
          </Typography>
          <Chip label="Testing" color="success" size="small" />
        </Box>
      </Box>
      <TestSuite suite={testSuite} setup={setup} />
    </Box>
  );
}
