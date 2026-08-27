"use client";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { ArrowBack, Login, Storage } from "@mui/icons-material";
import { OperationOutcome } from "fhir/r4";
import { signIn, useSession } from "next-auth/react";
import NextLink from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { displayName, fetchMany, fetchOne } from "./data-source";
import { FhirResult } from "@/lib/models";
import { useCurrentFhirServer } from "@/lib/states";
import CodeEditor from "@/components/code-editor";
import PageHeader from "@/components/page-header";

function describeError(e: unknown): ReactNode {
  if (e instanceof Error) {
    return `${e.name}: ${e.message}`;
  }
  const outcome = e as Partial<OperationOutcome> | null;
  if (outcome?.resourceType === "OperationOutcome" && outcome.issue?.length) {
    return outcome.issue.map((issue, i) => (
      <div key={i}>
        ({issue.severity}): {issue.diagnostics}
      </div>
    ));
  }
  return "An error occurred. Check the console for more information.";
}

export default function FhirPage() {
  const fhirServer = useCurrentFhirServer((state) => state.currentFhirServer);
  const { data: session, status } = useSession();
  const { slug } = useParams<{ slug: string[] }>();
  const router = useRouter();
  const [resourceType, id] = slug ?? [];
  const signedIn = status === "authenticated" && !!session?.accessToken;

  // Results are tagged with the request they answer, so "loading" is derived instead of stored.
  const requestKey = `${fhirServer}|${resourceType}|${id ?? ""}|${session?.accessToken ?? ""}`;
  const [result, setResult] = useState<{
    key: string;
    items: FhirResult[];
    total?: number;
    resource: FhirResult | null;
    error?: ReactNode;
  }>({ key: "", items: [], resource: null });

  useEffect(() => {
    if (!fhirServer || !resourceType || !signedIn) return;
    let cancelled = false;
    const request = id
      ? fetchOne(fhirServer, resourceType, id, session).then((resource) => ({
          items: [],
          resource,
        }))
      : fetchMany(fhirServer, resourceType, session).then((r) => ({ ...r, resource: null }));
    request
      .then((r) => !cancelled && setResult({ key: requestKey, ...r }))
      .catch((e) => {
        console.error(e);
        if (!cancelled) setResult({ key: requestKey, items: [], resource: null, error: describeError(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [fhirServer, resourceType, id, session, signedIn, requestKey]);

  const loading = !!fhirServer && !!resourceType && (status === "loading" || (signedIn && result.key !== requestKey));
  const { items, total, resource, error } = result;

  const hasName = items.some((r) => "name" in r);

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        icon={<Storage />}
        title={`${resourceType} ${id ? id : "Resources"}`}
        tag="Authorization Code"
        description={
          <>
            Server: <code>{fhirServer}</code>
          </>
        }
      />

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {!fhirServer ? (
        <Alert severity="error">FHIR Server not selected.</Alert>
      ) : status === "unauthenticated" ? (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" startIcon={<Login />} sx={{ whiteSpace: "nowrap" }} onClick={() => signIn("udap")}>
              Sign In
            </Button>
          }
        >
          Sign in with the Authorization Code flow to query {resourceType} resources on behalf of a user.
        </Alert>
      ) : id ? (
        <>
          <Button
            component={NextLink}
            href={`/fhir/${resourceType}`}
            startIcon={<ArrowBack />}
            sx={{ mb: 2 }}
          >
            Back to {resourceType} list
          </Button>
          <CodeEditor height="70vh" value={resource ? JSON.stringify(resource, null, 2) : ""} />
        </>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Resource Type</TableCell>
                {hasName && <TableCell>Name</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((r) => (
                <TableRow
                  key={r.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => router.push(`/fhir/${resourceType}/${r.id}`)}
                >
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.resourceType}</TableCell>
                  {hasName && (
                    <TableCell>
                      {displayName("name" in r ? (r.name as Parameters<typeof displayName>[0]) : undefined)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!loading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    No resources returned.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", p: 1.5 }}>
            Showing {items.length}
            {total !== undefined ? ` of ${total}` : ""} (first page only)
          </Typography>
        </TableContainer>
      )}
    </Box>
  );
}
