
import { DataSource, DataSourceCache } from "@toolpad/core";
import { BundleEntry, HumanName } from "fhir/r4";
import { Session } from "next-auth";
import { FhirResult } from "@/lib/models";


export const fhirDataCache = new DataSourceCache();

export function getFhirDataSource(fhirServer: string, resourceType: string, session: Session|null = null, handleError?: (e: unknown) => void): DataSource<FhirResult> {

  if (!handleError) {
    handleError = (e) => {
      console.error("Data source error:", e);
    };
  }

  return {

    fields: [
      { field: 'id', headerName: 'ID' },
      { field: 'resourceType', headerName: 'Resource Type' },
      { 
        field: 'name', 
        headerName: 'Name', 
        type: 'custom',
        valueGetter: (name: HumanName[]) => {
          if (!name || name.length < 1) return '';
          return `${name[0].given?.join(' ')} ${name[0].family}`
        },
      },
    ],

    getMany: async ({ paginationModel, filterModel, sortModel }) => {

      // setErrorMessage("");
      console.log('FHIR data source:', fhirServer, resourceType);

      if (!fhirServer || !resourceType) {
        return {
          items: [],
          itemCount: 0
        };
      }

      try
      {
        const query = await fetch(`${fhirServer}/${resourceType}`, {
          headers: {
            Authorization: `Bearer ${session?.accessToken}` 
          }
        });
        const res = await query.json();
        return {
          items: (res.entry || []).map((e: BundleEntry) => e.resource),
          itemCount: res.total
        }
      } catch (e) {
        console.error('Failed to load FHIR data:', e);
        handleError(e);
        return {
          items: [],
          itemCount: 0
        };
      }
      
    },

    getOne: async (id) => {

      if (!fhirServer || !resourceType || !id) {
        return {} as FhirResult;
      }
      
      try {
        const query = await fetch(`${fhirServer}/${resourceType}/${id}`, {
          headers: {
            Authorization: `Bearer ${session?.accessToken}`
          }
        });
        const res = await query.json();
        if (!res) {
          console.error('Failed to load FHIR data.  No response.');
          return {} as FhirResult;
        }
        return res as FhirResult;

      } catch (e) {
        handleError(e);
        console.error('Error loading FHIR data:', e);
        return {} as FhirResult;
      }
    },

  }
}
