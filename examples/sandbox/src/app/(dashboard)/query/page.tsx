"use client";

import { useRef, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { Code, Send } from "@mui/icons-material";
import CodeEditor from "@/components/code-editor";
import PageHeader from "@/components/page-header";
import { BASE_PATH } from "@/lib/constants";

export default function QueryPage() {
  const defaultUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}${BASE_PATH}/api/fhir/Patient`
      : "http://localhost:3000/api/fhir/Patient";

  const [queryUrl, setQueryUrl] = useState(defaultUrl);
  const [result, setResult] = useState<string>("// Query result will appear here");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleQuery = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(queryUrl);
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setResult(`// Error: ${errorMessage}`);
    } finally {
      setLoading(false);
      // Return focus to input after query completes with a small delay
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        icon={<Code />}
        title="FHIR Query Interface"
        tag="Client Credentials"
        color="secondary"
        description={
          <>
            Query the <code>/api/fhir</code> endpoint using the client credentials flow. Requests
            are proxied to the FHIR server with automatic access token management.
          </>
        }
      >
        <Alert severity="info">
          Compare network traffic in your browser&apos;s developer tools with the authorization
          code flow on the Patients page.
        </Alert>
      </PageHeader>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
            Request
          </Typography>
          <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
            <TextField
              fullWidth
              label="FHIR Endpoint URL"
              value={queryUrl}
              onChange={(e) => setQueryUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  handleQuery();
                }
              }}
              placeholder="http://localhost:3000/api/fhir/Patient"
              helperText="Press Enter to send"
              disabled={loading}
              inputRef={inputRef}
            />
            <Button
              variant="contained"
              onClick={handleQuery}
              disabled={loading}
              startIcon={<Send />}
              sx={{ minWidth: 140, height: 56, flexShrink: 0 }}
            >
              {loading ? "Querying..." : "Send"}
            </Button>
          </Stack>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
            Response
          </Typography>
          <CodeEditor height="60vh" value={result} />
        </CardContent>
      </Card>
    </Box>
  );
}
