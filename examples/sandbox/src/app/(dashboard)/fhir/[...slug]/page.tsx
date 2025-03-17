
"use client"
import { FhirResult } from "@/lib/models";
import { useCurrentFhirServer } from "@/lib/states";
import { Typography } from "@mui/material";
import { Crud, DataSource, DataSourceCache } from "@toolpad/core";
import Client from "fhir-kit-client";
import { BundleEntry, HumanName } from "fhir/r4";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function FhirPage({params}: {
  params: Promise<{ slug: string[] }>
}) {

  const [resourceType, setResourceType] = useState<string|undefined>();
  const [rootPath, setRootPath] = useState<string>("/fhir");
  const fhirServer = useCurrentFhirServer((state) => state.currentFhirServer);
  const { data: session } = useSession();
  const dataCache = new DataSourceCache();


  useEffect(() => {
    params.then((p) => {
      setResourceType(p.slug[0]);
      setRootPath(`/fhir/${p.slug[0]}`);
    });
  }, [params]);


  const fhirDataSource: DataSource<FhirResult> = {

    fields: [
      { field: 'id', headerName: 'ID' },
      { field: 'resourceType', headerName: 'Resource Type' },
      { 
        field: 'name', headerName: 'Name', type: 'custom',
        valueGetter: (name: HumanName[]) => {
          if (!name || name.length < 1) return '';
          return `${name[0].given?.join(' ')} ${name[0].family}`
        },
      },
    ],

    getMany: async ({ paginationModel, filterModel, sortModel }) => {

      console.log('FHIR data source:', fhirServer, resourceType);

      if (!fhirServer || !resourceType) {
        return {
          items: [],
          itemCount: 0
        };
      }
      // return {
      //   items: [{
      //     id: '1',
      //     resourceType: 'Patient',
      //     name: [{ family: 'Doe', given: ['John']}]
      //   }],
      //   itemCount: 1
      // };

      const client = new Client({baseUrl: fhirServer, bearerToken: session?.accessToken});
      const res = await client.search({resourceType: resourceType});
      return {
        items: (res.entry || []).map((e: BundleEntry) => e.resource),
        itemCount: res.total
      };
    },

    getOne: async (id) => {

      if (!fhirServer || !resourceType || !id) {
        return new Promise<FhirResult>((resolve, reject) => {
          reject('Failed to load FHIR data');
        });
      }

      console.log("getOne:", id);
      
      const client = new Client({baseUrl: fhirServer, bearerToken: session?.accessToken});
      const res = await client.read({resourceType: resourceType, id: id.toString()});
      if (!res) {
        return new Promise<FhirResult>((resolve, reject) => {
          reject('Failed to load FHIR data');
        });
      }
      return res as FhirResult;
    },

  }


  return (
    <>
      <Typography variant="h6">{resourceType} Viewer</Typography>
      <Typography variant="subtitle1">Server: {fhirServer}</Typography>
      {
        resourceType ?
        <>
          <Crud<FhirResult>
            dataSource={fhirDataSource}
            dataSourceCache={dataCache}
            rootPath={rootPath}
          />
        </>
        :
        <p>
          Loading...
        </p>
      }
    </>
  )
}