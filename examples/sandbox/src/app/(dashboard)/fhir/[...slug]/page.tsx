"use client";
import { Alert, Typography } from "@mui/material";
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
    console.log("Registering datasource", fhirServer, resourceType);
    if (!fhirServer || !resourceType) {
      setDataSource(undefined);
      return;
    }
    setDataSource(getFhirDataSource(fhirServer, resourceType, session, handleError));
  }, [fhirServer, resourceType, session]);

  useEffect(() => {
    console.log("Data source changed:", dataSource);
  }, [dataSource]);

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
    <>
      <Typography variant="h6">{resourceType} Resources</Typography>
      <Typography variant="subtitle1">Server: {fhirServer}</Typography>
      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
      <>
        {!fhirServer ? (
          <Alert severity="error">{!fhirServer && <div>FHIR Server not selected.</div>}</Alert>
        ) : fhirServer && resourceType && dataSource ? (
          <Crud<FhirResult>
            dataSource={dataSource}
            dataSourceCache={fhirDataCache}
            rootPath={`/fhir/${resourceType}`}
          />
        ) : (
          <Alert severity="error">
            <div>Data source not available.</div>
          </Alert>
        )}
      </>
    </>
  );
}
