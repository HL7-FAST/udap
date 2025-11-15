"use client";

import { useRef, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Paper, TextField, Typography } from "@mui/material";
import { Code, Send } from "@mui/icons-material";
import Editor from "@monaco-editor/react";

export default function QueryPage() {
  const defaultUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}/api/fhir/Patient`
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
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Code color="primary" />
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            FHIR Query Interface
          </Typography>
          <Chip label="Client Credentials" color="secondary" size="small" />
        </Box>
        <Typography variant="body1" color="text.secondary" paragraph>
          Query the <code>/api/fhir</code> endpoint using the client credentials flow. 
          Requests are proxied to the FHIR server with automatic access token management.
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          💡 Compare network traffic in your browser&apos;s developer tools with the authorization code flow on the Patients page.
        </Alert>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Request
          </Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
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
              variant="outlined"
              inputRef={inputRef}
            />
            <Button
              variant="contained"
              onClick={handleQuery}
              disabled={loading}
              startIcon={<Send />}
              sx={{ minWidth: 140, height: 56 }}
            >
              {loading ? "Querying..." : "Send"}
            </Button>
          </Box>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Paper sx={{ p: 3, height: "600px", bgcolor: "background.default" }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Response
        </Typography>
        <Box sx={{ height: "calc(100% - 48px)", borderRadius: 1, overflow: "hidden" }}>
          <Editor
            height="100%"
            defaultLanguage="json"
            value={result}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              lineNumbers: "on",
              renderLineHighlight: "none",
            }}
          />
        </Box>
      </Paper>
    </Box>
  );
}
