import { create } from "zustand";
import { UdapClient } from "./models";
import Cookies from "universal-cookie";
import { COOKIE_CURRENT_FHIR_SERVER } from "./constants";



export interface ClientState {
  client: UdapClient | undefined;
  setClient: (client: UdapClient) => void;
}

export const useUdapClientState = create<ClientState>((set) => ({
  client: undefined,
  setClient: (client) => {
    set({ client });
  }
}));



export interface CurrentFhirServer {
  currentFhirServer: string;
  setCurrentFhirServer: (fhirServer: string) => void;
}

export const useCurrentFhirServer = create<CurrentFhirServer>((set) => ({
  currentFhirServer: "",
  setCurrentFhirServer: (fhirServer) => {
    const cookies = new Cookies(null, { path: '/' });
    cookies.set(COOKIE_CURRENT_FHIR_SERVER, fhirServer);
    set({ currentFhirServer: fhirServer });
  }
}));

export interface AvailableFhirServers {
  fhirServers: string[];
  setFhirServers: (fhirServers: string[]) => void;
}

export const useAvailableFhirServers = create<AvailableFhirServers>((set) => ({
  fhirServers: [],
  setFhirServers: (fhirServers) => {
    set({ fhirServers });
  }
}));

