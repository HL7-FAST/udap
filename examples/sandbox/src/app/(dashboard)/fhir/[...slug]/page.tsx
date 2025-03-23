"use client"
import { Alert, Typography } from "@mui/material";
import { Crud } from "@toolpad/core";
import { OperationOutcome } from "fhir/r4";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { fhirDataCache, getFhirDataSource } from "./data-source";
import { FhirResult } from "@/lib/models";
import { useCurrentFhirServer } from "@/lib/states";


export default function FhirPage() {

  const fhirServer = useCurrentFhirServer((state) => state.currentFhirServer);
  const { data: session } = useSession();
  const [errorMessage, setErrorMessage] = useState<string>();
  const resourceType = useParams<{ slug: string[] }>().slug[0];
  const datasource = getFhirDataSource(fhirServer, resourceType, session, handleError);


  function handleError(e: unknown) {
    console.error("Error:", e);
    setErrorMessage("An error occurred. Check the console for more information.");

    if (e instanceof Error) {
      console.error(e.stack);
      setErrorMessage(`${e.name}: ${e.message}`);
    } else if (typeof e === "object" && e !== null && "response" in e) {
      const errorResponse = e as { response: { data: object|string } };
      if (typeof errorResponse.response.data === "object" 
          && "resourceType" in errorResponse.response.data 
          && errorResponse.response.data.resourceType === "OperationOutcome") {
        const outcome = errorResponse.response.data as OperationOutcome;

        if (outcome.issue && outcome.issue.length > 0) {
          setErrorMessage(outcome.issue.map((i) => `${i.severity}: ${i.diagnostics}`).join('; '));
        }
      } else {
        setErrorMessage(errorResponse.response.data?.toString() ?? "An error occurred. Check the console for more information.");
      }
    }

  }  


  return (
    <>
      <Typography variant="h6">{resourceType} Resources</Typography>
      <Typography variant="subtitle1">Server: {fhirServer}</Typography>
      {
        errorMessage && 
        <Alert severity="error">
          {errorMessage}
        </Alert>
      }
      <>
        {
          !fhirServer &&
          <Alert severity="error">
            {!fhirServer && <div>FHIR Server not selected.</div>}
          </Alert>
        }
        <Crud<FhirResult>
          dataSource={datasource}
          dataSourceCache={fhirDataCache}
          rootPath={`/fhir/${resourceType}`}
        />        
      </>
    </>
  )
}