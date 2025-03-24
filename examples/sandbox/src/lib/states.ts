import { CapabilityStatement } from "fhir/r4";
import Cookies from "universal-cookie";
import { create } from "zustand";
import { getResourceTypes, getServerCapabilityStatement } from "./fhir";
import { COOKIE_CURRENT_FHIR_SERVER } from "./constants";
import { UdapClient } from "./models";

export interface ClientState {
  client: UdapClient | undefined;
  setClient: (client: UdapClient) => void;
}

export const useUdapClientState = create<ClientState>((set) => ({
  client: undefined,
  setClient: (client) => {
    set({ client });
  },
}));

export interface CurrentFhirServer {
  currentFhirServer: string;
  setCurrentFhirServer: (fhirServer: string) => void;
}

export const useCurrentFhirServer = create<CurrentFhirServer>((set) => ({
  currentFhirServer: "",
  setCurrentFhirServer: (fhirServer) => {
    // save the current fhir server in a cookie for future server requests
    const cookies = new Cookies(null, { path: "/" });
    cookies.set(COOKIE_CURRENT_FHIR_SERVER, fhirServer);

    set({ currentFhirServer: fhirServer });

    if (fhirServer) {
      // get the capability statement for the new server
      useCurrentServerCapabilityStatement
        .getState()
        .setCurrentCapabilityStatement();
      getServerCapabilityStatement(fhirServer).then((capabilityStatement) => {
        useCurrentServerCapabilityStatement
          .getState()
          .setCurrentCapabilityStatement(capabilityStatement);
      });
    }
  },
}));

export interface AvailableFhirServers {
  fhirServers: string[];
  setFhirServers: (fhirServers: string[]) => void;
}

export const useAvailableFhirServers = create<AvailableFhirServers>((set) => ({
  fhirServers: [],
  setFhirServers: (fhirServers) => {
    set({ fhirServers });
  },
}));

export interface CurrentServerCapabilityStatement {
  curentCapabilityStatement: CapabilityStatement | undefined;
  setCurrentCapabilityStatement: (
    capabilityStatement?: CapabilityStatement,
  ) => void;
}

export const useCurrentServerCapabilityStatement =
  create<CurrentServerCapabilityStatement>((set) => ({
    curentCapabilityStatement: undefined,
    setCurrentCapabilityStatement: (capabilityStatement) => {
      set({ curentCapabilityStatement: capabilityStatement });

      if (capabilityStatement) {
        const resourceTypes = getResourceTypes(capabilityStatement);
        useAvailableResourceTypes.getState().setResourceTypes(resourceTypes);
      }
    },
  }));

export interface AvailableResourceTypes {
  resourceTypes: string[];
  setResourceTypes: (resourceTypes: string[]) => void;
}

export const useAvailableResourceTypes = create<AvailableResourceTypes>(
  (set) => ({
    resourceTypes: [],
    setResourceTypes: (resourceTypes) => {
      set({ resourceTypes });
    },
  }),
);

