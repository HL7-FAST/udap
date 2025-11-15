

"use client";

import { useState } from "react";
import { Box, Button, Paper, TextField, Typography } from "@mui/material";
import Editor from "@monaco-editor/react";

export default function QueryPage() {
  const defaultUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}/api/fhir/Patient`
    : "http://localhost:3000/api/fhir/Patient";

  const [queryUrl, setQueryUrl] = useState(defaultUrl);
  const [result, setResult] = useState<string>("// Query result will appear here");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    }
  };

  return (
    <Box sx={{ p: 3 }}>

      <Typography variant="body1" sx={{ mb: 2 }}>
        This page is for convenience to query the <code>/api/fhir</code> endpoint (or anything, really).
        Queries to this endpoint will be proxied to the FHIR server that is registered with the default <code>client_credentials</code> UDAP client.
        It will automatically obtain an access token using the registered client.
      </Typography>

      <Typography variant="body1" sx={{ mb: 2 }}>
        Check your browser&apos;s developer tools network traffic to compare the requests made here with those made using the <code>authorization_code</code> flow on the Patients page.
      </Typography>

      <Typography variant="h5" gutterBottom>
        FHIR Query
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
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
            disabled={loading}
          />
          <Button
            variant="contained"
            onClick={handleQuery}
            disabled={loading}
            sx={{ minWidth: 120 }}
          >
            {loading ? "Querying..." : "Query"}
          </Button>
        </Box>

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            Error: {error}
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2, height: "600px" }}>
        <Typography variant="h6" gutterBottom>
          Result
        </Typography>
        <Editor
          height="calc(100% - 40px)"
          defaultLanguage="json"
          value={result}
          options={{
            readOnly: true,
            scrollBeyondLastLine: false,
            fontSize: 14,
          }}
        />
      </Paper>
    </Box>
  );
}
