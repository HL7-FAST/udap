"use client";
import { Alert, Box, Chip, Divider, Typography } from "@mui/material";
import { Storage } from "@mui/icons-material";
import { Crud, DataSource } from "@toolpad/core";
import { OperationOutcome } from "fhir/r4";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { fhirDataCache, getFhirDataSource } from "./data-source";
import { FhirResult } from "@/lib/models";
import { useCurrentFhirServer } from "@/lib/states";

export default function FhirPage() {
  const fhirServer = useCurrentFhirServer((state) => state.currentFhirServer);
  const { data: session } = useSession();
  const [errorMessage, setErrorMessage] = useState<ReactNode>();
  const params = useParams<{ slug: string[] }>();
  const [resourceType, setResourceType] = useState<string | undefined>();
  const [dataSource, setDataSource] = useState<DataSource<FhirResult> | undefined>();

  useEffect(() => {
    if (params.slug && params.slug.length > 0) {
      setResourceType(params.slug[0]);
    } else {
      setResourceType(undefined);
    }
  }, [params]);

  useEffect(() => {
    if (!fhirServer || !resourceType) {
      setDataSource(undefined);
      return;
    }
    setDataSource(getFhirDataSource(fhirServer, resourceType, session, handleError));
  }, [fhirServer, resourceType, session]);

  useEffect(() => {
    fhirDataCache.clear();
  }, [resourceType]);

  function handleError(e: unknown) {
    // console.error("Error:", e);
    setErrorMessage("An error occurred. Check the console for more information.");

    if (e instanceof Error) {
      console.error(e.stack);
      setErrorMessage(`${e.name}: ${e.message}`);
    } else if (typeof e === "object" && e !== null && "response" in e) {
      console.log("error is object with response");
      const errorResponse = e as { response: { data: object | string } };
      if (
        typeof errorResponse.response.data === "object" &&
        "resourceType" in errorResponse.response.data &&
        errorResponse.response.data.resourceType === "OperationOutcome"
      ) {
        const outcome = errorResponse.response.data as OperationOutcome;

        if (outcome.issue && outcome.issue.length > 0) {
          setErrorMessage(outcome.issue.map((i) => `(${i.severity}): ${i.diagnostics}`).join("; "));
        }
      }
    } else if (
      typeof e === "object" &&
      e !== null &&
      "resourceType" in e &&
      e.resourceType === "OperationOutcome"
    ) {
      console.log("error is OperationOutcome");
      const outcome = e as OperationOutcome;
      if (outcome.issue && outcome.issue.length > 0) {
        setErrorMessage(
          outcome.issue.map((issue, i) => (
            <div key={i}>
              ({issue.severity}): {issue.diagnostics}
            </div>
          )),
        );
      }
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Storage color="primary" />
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {resourceType} Resources
          </Typography>
          <Chip label="Authorization Code" color="primary" size="small" />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          Server: <code style={{ fontSize: "0.875rem" }}>{fhirServer}</code>
        </Typography>
      </Box>
      <Divider sx={{ mb: 3 }} />
      {errorMessage && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert>}
      {!fhirServer ? (
        <Alert severity="error">FHIR Server not selected.</Alert>
      ) : fhirServer && resourceType && dataSource ? (
        <Crud<FhirResult>
          dataSource={dataSource}
          dataSourceCache={fhirDataCache}
          rootPath={`/fhir/${resourceType}`}
        />
      ) : (
        <Alert severity="error">Data source not available.</Alert>
      )}
    </Box>
  );
}
