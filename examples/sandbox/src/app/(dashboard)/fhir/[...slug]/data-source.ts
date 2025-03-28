import { DataSource, DataSourceCache } from "@toolpad/core";
import { BundleEntry, HumanName } from "fhir/r4";
import { Session } from "next-auth";
import { FhirResult } from "@/lib/models";

export const fhirDataCache = new DataSourceCache();

export function getFhirDataSource(
  fhirServer: string,
  resourceType: string,
  session: Session | null = null,
  handleError?: (e: unknown) => void,
): DataSource<FhirResult> {
  if (!handleError) {
    handleError = (e) => {
      console.error("Data source error:", e);
    };
  }

  return {
    fields: [
      { field: "id", headerName: "ID" },
      { field: "resourceType", headerName: "Resource Type" },
      {
        field: "name",
        headerName: "Name",
        type: "custom",
        valueGetter: (name: HumanName[]) => {
          if (!name || name.length < 1) return "";
          return `${name[0].given?.join(" ")} ${name[0].family}`;
        },
      },
    ],

    getMany: async (/*{ paginationModel, filterModel, sortModel }*/) => {
      // console.log("getMany:", paginationModel, filterModel, sortModel, fhirServer, resourceType);

      if (!fhirServer || !resourceType) {
        return {
          items: [],
          itemCount: 0,
        };
      }

      try {
        let headers = {};
        if (session?.accessToken) {
          headers = {
            Authorization: `Bearer ${session?.accessToken}`,
          };
        }
        const query = await fetch(`${fhirServer}/${resourceType}`, { headers });

        if (!query.ok) {
          if (query.status === 401) {
            if (handleError) {
              if (
                query.headers.get("content-type")?.includes("application/json") ||
                query.headers.get("content-type")?.includes("application/fhir+json")
              ) {
                handleError(await query.json());
              } else {
                handleError(new Error("Unauthorized: " + (await query.text())));
              }
            } else {
              console.error("Unauthorized.  Please login again.");
            }

            return {
              items: [],
              itemCount: 0,
            };
          }

          try {
            const res = await query.json();
            if (handleError) {
              handleError(res);
            } else {
              console.error("No error handler provided.  Error response:", res);
            }
          } catch (e) {
            if (handleError) {
              handleError(e);
            } else {
              console.error("No error handler provided.  Error response:", e);
            }
          }

          return {
            items: [],
            itemCount: 0,
          };
        }

        const res = await query.json();
        return {
          items: (res.entry || []).map((e: BundleEntry) => e.resource),
          itemCount: res.total,
        };
      } catch (e) {
        handleError(e);
        return {
          items: [],
          itemCount: 0,
        };
      }
    },

    getOne: async (id) => {
      if (!fhirServer || !resourceType || !id) {
        return {} as FhirResult;
      }

      try {
        let headers = {};
        if (session?.accessToken) {
          headers = {
            Authorization: `Bearer ${session?.accessToken}`,
          };
        }
        const query = await fetch(`${fhirServer}/${resourceType}/${id}`, {
          headers,
        });
        const res = await query.json();
        if (!res) {
          console.error("Failed to load FHIR data.  No response.");
          return {} as FhirResult;
        }
        return res as FhirResult;
      } catch (e) {
        handleError(e);
        console.error("Error loading FHIR data:", e);
        return {} as FhirResult;
      }
    },
  };
}
