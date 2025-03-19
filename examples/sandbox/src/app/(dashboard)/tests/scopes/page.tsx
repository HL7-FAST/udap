"use client"

import TestSuite from '@/components/tests/test-suite';
import ScopeNegotiationTestSuite from '@/lib/tests/scopes/scope-negotiation-suite';
import ScopesSupportedTest from '@/lib/tests/scopes/scopes-supported';
import { TestSuiteParams } from '@/lib/tests/test-suite';
import { Alert, FormGroup, Link, Stack, Typography } from '@mui/material';
import { PageContainerProps, useActivePage, useLocalStorageState } from '@toolpad/core';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';



export default function ScopesPage() {

  const [fhirServer, setFhirServer] = useState<string>();

  useEffect(() => {
    setFhirServer("http://localhost:8080/fhir");
  },[]);

  
  const setup = (
    <Stack direction="column" spacing={2}>
      <Alert severity="info">
        Sending requests to <Link href={fhirServer}>{fhirServer}</Link>
      </Alert>
      <FormGroup>
        <Typography variant="h6">Setup</Typography>
        <Markdown remarkPlugins={[remarkGfm]}>{`This is the \`setup\` for the tests.`}</Markdown>
      </FormGroup>
    </Stack>
  );

  const suite = new ScopeNegotiationTestSuite();
  const params: TestSuiteParams ={ 
    "scopes-supported": { fhirServer } 
  }

  return (
    <>
      <TestSuite suite={suite} params={params} setup={setup} />
    </>
  );
}
