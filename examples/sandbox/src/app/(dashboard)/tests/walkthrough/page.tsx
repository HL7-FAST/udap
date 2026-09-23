"use client";

import { Add, Block, Delete, ExpandMore } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Collapse,
  IconButton,
  MenuItem,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessResult,
  DiscoveryResult,
  ErrorAlert,
  IssueCertificateResult,
  RegisterResult,
  RevokeInstructions,
  ScenarioDescription,
  StepButtonRow,
  TokenBeforeResult,
  VerifyResult,
} from "./steps";
import { BASE_PATH } from "@/lib/constants";
import PageHeader from "@/components/page-header";
import { getDefaultFhirServer } from "@/lib/env";
import { UdapClient } from "@/lib/models";
import type { AccessRunOutcome } from "@/lib/access-outcome";
import { CertificateFacts } from "@/lib/tests/cert-facts";
import { judgeAccess } from "@/lib/tests/access-judge";
import { DiscoveryCheck, DiscoveryOutcome, discoveryPassed } from "@/lib/tests/discovery-outcome";
import { judgeTokenBeforeRevocation } from "@/lib/tests/revocation-outcome";
import { CertScenarioSummary, TrustRunOutcome, judgeTrustOutcome } from "@/lib/tests/trust-outcome";
import { TokenRunOutcome } from "@/lib/token-outcome";
import { useUdapClientState } from "@/lib/states";
import { useLocalStorageState } from "@/lib/use-local-storage-state";

const STORE_KEY = "scenario-walkthrough";
const DEFAULT_SERVER_URL = "https://localhost:5001";

type WalkthroughStepKey = "issue" | "discover" | "register" | "token" | "access" | "verify";
// Server and proxy fields share one grid so their columns line up. The last column holds the header delete icon.
const FIELD_GRID = { display: "grid", gridTemplateColumns: "1fr 1fr 34px", gap: 2, alignItems: "center" };

export interface WalkthroughProxy {
  resourceServer: string;
  authorizationServer: string;
}

export interface CustomHeader {
  name: string;
  value: string;
}

export interface WalkthroughState {
  serverUrl: string;
  fhirServer: string;
  proxy: WalkthroughProxy;
  headers: CustomHeader[];
  activeStep: number;
  revokedConfirmed: boolean;
  scenario?: CertScenarioSummary;
  certId?: string;
  pfx?: string;
  password?: string;
  serial?: string;
  certificate?: CertificateFacts;
  discovery?: DiscoveryOutcome;
  securityServerCheck?: DiscoveryCheck;
  client?: UdapClient;
  registration?: TrustRunOutcome;
  tokenBefore?: TokenRunOutcome;
  access?: AccessRunOutcome;
  tokenAfter?: TokenRunOutcome;
  registrationAfter?: TrustRunOutcome;
}

function initialState(serverUrl: string, fhirServer: string): WalkthroughState {
  return {
    serverUrl,
    fhirServer,
    proxy: { resourceServer: "", authorizationServer: "" },
    headers: [],
    activeStep: 0,
    revokedConfirmed: false,
  };
}

type StoredProxy = Partial<WalkthroughProxy> & { headers?: CustomHeader[]; keyName?: string; keyValue?: string };

/** Older stored state kept the headers inside the proxy, or as a single key/value pair. Both become header rows. */
function migrateSettings(parsed: Partial<WalkthroughState>): Pick<WalkthroughState, "proxy" | "headers"> {
  const raw = (parsed.proxy ?? {}) as StoredProxy;
  const proxy = { resourceServer: raw.resourceServer ?? "", authorizationServer: raw.authorizationServer ?? "" };
  if (Array.isArray(parsed.headers)) {
    return { proxy, headers: parsed.headers };
  }
  if (Array.isArray(raw.headers)) {
    return { proxy, headers: raw.headers };
  }
  return { proxy, headers: raw.keyValue ? [{ name: raw.keyName ?? "USER_KEY", value: raw.keyValue }] : [] };
}

const storageCodec = {
  // Older stored state predates fhirServer/proxy, so missing fields fall back to defaults
  // instead of leaving the page with undefined values it was not built to handle.
  parse: (raw: string): WalkthroughState => {
    try {
      const parsed = JSON.parse(raw) as Partial<WalkthroughState> | null;
      if (!parsed || typeof parsed.serverUrl !== "string") {
        return initialState(DEFAULT_SERVER_URL, "");
      }
      return {
        ...initialState(parsed.serverUrl, parsed.fhirServer ?? ""),
        ...parsed,
        ...migrateSettings(parsed),
      };
    } catch {
      return initialState(DEFAULT_SERVER_URL, "");
    }
  },
  stringify: (value: WalkthroughState) => JSON.stringify(value),
};

/** Drops empty proxy fields so the request body only carries what the user filled in. */
function buildProxy(proxy: WalkthroughProxy): { resourceServer?: string; authorizationServer?: string } | undefined {
  const resourceServer = proxy.resourceServer.trim();
  const authorizationServer = proxy.authorizationServer.trim();
  if (!resourceServer && !authorizationServer) {
    return undefined;
  }
  return {
    ...(resourceServer ? { resourceServer } : {}),
    ...(authorizationServer ? { authorizationServer } : {}),
  };
}

function namedHeaders(headers: CustomHeader[]): CustomHeader[] {
  return headers.filter((h) => h.name.trim().length > 0);
}

async function postStep<T>(body: unknown): Promise<T> {
  const response = await fetch(BASE_PATH + "/api/tests/walkthrough", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error ?? json.message ?? response.statusText);
  }
  return json as T;
}

/** SAN carried by every certificate this walkthrough issues, so registration and token steps can reuse it. */
function walkthroughAltName(): string {
  return window.location.origin + BASE_PATH + "/tests/walkthrough";
}

export default function ScenarioWalkthroughPage() {
  const udapClient = useUdapClientState((state) => state.client);
  const initialServerUrl = udapClient ? new URL(udapClient.authorizationEndpoint).origin : DEFAULT_SERVER_URL;

  const [state, setState] = useLocalStorageState<WalkthroughState>(
    STORE_KEY,
    initialState(initialServerUrl, ""),
    { codec: storageCodec },
  );
  const walkthrough = state ?? initialState(initialServerUrl, "");

  const [draft, setDraft] = useState(initialServerUrl);
  const [fhirDraft, setFhirDraft] = useState(walkthrough.fhirServer);
  const [proxyOpen, setProxyOpen] = useState(false);
  // One request runs at a time because each step builds on the one before. Only the step that
  // started it shows the spinner and any error.
  const [running, setRunning] = useState<WalkthroughStepKey | null>(null);
  const [error, setError] = useState<{ step: WalkthroughStepKey; message: string } | null>(null);
  const busy = running !== null;
  const errorFor = (step: WalkthroughStepKey) => (error?.step === step ? error.message : null);
  const [scenarios, setScenarios] = useState<CertScenarioSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState("valid");
  // Bumped on Start over and on a server URL change. A request that resolves after the bump
  // belongs to a walkthrough that no longer exists, so its result and any error are dropped.
  const runIdRef = useRef(0);

  // The draft only tracks the persisted server URL; once localStorage hydrates with a value
  // different from the SSR default, this brings the text field in line with it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs the draft to a value that only becomes known after localStorage hydration, which cannot happen during the render that reads it
    setDraft(walkthrough.serverUrl);
  }, [walkthrough.serverUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same hydration timing as the server URL draft above
    setFhirDraft(walkthrough.fhirServer);
  }, [walkthrough.fhirServer]);

  // Fills a default FHIR server exactly once, and only for state saved before this field existed.
  useEffect(() => {
    if (walkthrough.fhirServer) {
      return;
    }
    let cancelled = false;
    getDefaultFhirServer().then((url) => {
      if (!cancelled) {
        update({ fhirServer: url });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- update() reads the latest state from storage itself
  }, [walkthrough.fhirServer]);

  // The cleanup aborts a superseded catalog request so a late response cannot overwrite
  // a newer one from a fast server-URL change.
  useEffect(() => {
    const controller = new AbortController();
    fetch(BASE_PATH + "/api/tests/certificates?serverUrl=" + encodeURIComponent(walkthrough.serverUrl), {
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = await response.json();
        if (controller.signal.aborted) {
          return;
        }
        if (!response.ok) {
          throw new Error(json.error ?? json.message ?? response.statusText);
        }
        setScenarios(json as CertScenarioSummary[]);
      })
      .catch((e) => {
        if (controller.signal.aborted) {
          return;
        }
        setScenarios([]);
        setLoadError(e instanceof Error ? e.message : "Unknown error");
      });
    return () => controller.abort();
  }, [walkthrough.serverUrl]);

  // Merges onto whatever is currently in storage, not onto `walkthrough` from this render's
  // closure, so a patch built before an await cannot clobber a change made during that await.
  function update(patch: Partial<WalkthroughState>) {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORE_KEY) : null;
    const latest = raw ? storageCodec.parse(raw) : walkthrough;
    setState({ ...latest, ...patch });
  }

  function resetTo(serverUrl: string) {
    runIdRef.current += 1;
    // The FHIR server, proxy, and header settings are independent of the certificate/registration
    // progress being reset here, so they carry over rather than reverting to defaults.
    setState({ ...initialState(serverUrl, walkthrough.fhirServer), proxy: walkthrough.proxy, headers: walkthrough.headers });
    setError(null);
    // The catalog effect only refetches on a new server URL, so a same-server reset keeps the
    // loaded catalog. Clearing it here would leave Issue disabled with nothing to reload it.
    if (serverUrl !== walkthrough.serverUrl) {
      setScenarios([]);
      setLoadError(null);
    }
    // A reset while a request is in flight orphans it (the runId guard drops its result), so
    // nothing will ever flip busy back off on its own.
    setRunning(null);
  }

  function commitServerUrl() {
    const url = draft.trim();
    if (url && url !== walkthrough.serverUrl) {
      resetTo(url);
    }
  }

  function commitFhirServer() {
    const url = fhirDraft.trim();
    if (url && url !== walkthrough.fhirServer) {
      update({ fhirServer: url });
    }
  }

  async function runStep<T>(step: WalkthroughStepKey, fn: () => Promise<T>): Promise<T | undefined> {
    const runId = runIdRef.current;
    setRunning(step);
    setError(null);
    try {
      const value = await fn();
      return runIdRef.current === runId ? value : undefined;
    } catch (e) {
      if (runIdRef.current === runId) {
        setError({ step, message: e instanceof Error ? e.message : "Unknown error" });
      }
      return undefined;
    } finally {
      if (runIdRef.current === runId) {
        setRunning(null);
      }
    }
  }

  function baseBody(): {
    serverUrl: string;
    fhirServer: string;
    proxy?: ReturnType<typeof buildProxy>;
    headers?: CustomHeader[];
  } {
    const headers = namedHeaders(walkthrough.headers);
    return {
      serverUrl: walkthrough.serverUrl,
      fhirServer: walkthrough.fhirServer,
      proxy: buildProxy(walkthrough.proxy),
      ...(headers.length > 0 ? { headers } : {}),
    };
  }

  const issueCertificate = async () => {
    const scenario = scenarios.find((s) => s.key === selectedKey);
    if (!scenario) {
      return;
    }
    const result = await runStep("issue", () =>
      postStep<{ certId: string; pfx: string; password: string; serial: string; certificate: CertificateFacts }>({
        ...baseBody(),
        action: "issue",
        altName: walkthroughAltName(),
        scenario: scenario.key,
      }),
    );
    if (!result) {
      return;
    }
    update({
      scenario,
      certId: result.certId,
      pfx: result.pfx,
      password: result.password,
      serial: result.serial,
      certificate: result.certificate,
      discovery: undefined,
      securityServerCheck: undefined,
      client: undefined,
      registration: undefined,
      tokenBefore: undefined,
      access: undefined,
      tokenAfter: undefined,
      registrationAfter: undefined,
      revokedConfirmed: false,
      activeStep: 1,
    });
  };

  const discover = async () => {
    const result = await runStep("discover", () =>
      postStep<{ discovery: DiscoveryOutcome; securityServerCheck: DiscoveryCheck }>({
        ...baseBody(),
        action: "discover",
        certId: walkthrough.certId,
      }),
    );
    if (!result) {
      return;
    }
    const advance = discoveryPassed(result.discovery.checks);
    update({
      discovery: result.discovery,
      securityServerCheck: result.securityServerCheck,
      client: undefined,
      registration: undefined,
      tokenBefore: undefined,
      access: undefined,
      tokenAfter: undefined,
      registrationAfter: undefined,
      revokedConfirmed: false,
      ...(advance ? { activeStep: 2 } : {}),
    });
  };

  const registerClient = async () => {
    const result = await runStep("register", () =>
      postStep<{ registration: TrustRunOutcome }>({
        ...baseBody(),
        action: "register",
        certId: walkthrough.certId,
        altName: walkthroughAltName(),
        scenario: walkthrough.scenario?.key,
      }),
    );
    if (!result) {
      return;
    }
    const accepted = result.registration.outcome === "accepted";
    update({
      registration: result.registration,
      client: accepted ? (result.registration.body as UdapClient) : undefined,
      tokenBefore: undefined,
      access: undefined,
      tokenAfter: undefined,
      registrationAfter: undefined,
      revokedConfirmed: false,
      ...(accepted ? { activeStep: 3 } : {}),
    });
  };

  const requestTokenBefore = async () => {
    const result = await runStep("token", () =>
      postStep<{ token: TokenRunOutcome }>({
        ...baseBody(),
        action: "token",
        certId: walkthrough.certId,
        clientId: walkthrough.client?.id,
      }),
    );
    if (!result) {
      return;
    }
    const advance = judgeTokenBeforeRevocation(result.token).result === "pass";
    update({
      tokenBefore: result.token,
      access: undefined,
      tokenAfter: undefined,
      registrationAfter: undefined,
      revokedConfirmed: false,
      ...(advance ? { activeStep: 4 } : {}),
    });
  };

  const accessResource = async () => {
    const result = await runStep("access", () =>
      postStep<{ access: AccessRunOutcome }>({
        ...baseBody(),
        action: "access",
        accessToken: walkthrough.tokenBefore?.outcome === "issued" ? walkthrough.tokenBefore.accessToken : undefined,
      }),
    );
    if (!result) {
      return;
    }
    const advance = judgeAccess(result.access).result === "pass";
    update({
      access: result.access,
      ...(advance ? { activeStep: 5 } : {}),
    });
  };

  const confirmRevoked = () => {
    update({ revokedConfirmed: true, activeStep: 6 });
  };

  const verify = async () => {
    const result = await runStep("verify", async () => {
      const tokenResult = await postStep<{ token: TokenRunOutcome }>({
        ...baseBody(),
        action: "token",
        certId: walkthrough.certId,
        clientId: walkthrough.client?.id,
      });
      const registrationResult = await postStep<{ registration: TrustRunOutcome }>({
        ...baseBody(),
        action: "register",
        certId: walkthrough.certId,
        altName: walkthroughAltName(),
        scenario: walkthrough.scenario?.key,
      });
      return { tokenAfter: tokenResult.token, registrationAfter: registrationResult.registration };
    });
    if (result) {
      update(result);
    }
  };

  // Falls back to the catalog entry for the picker's current selection before anything has been issued,
  // so the stepper previews a scenario's steps even before the user issues a certificate for it.
  const selected = scenarios.find((s) => s.key === selectedKey);
  // Step visibility follows the issued certificate's scenario until the next issue. The
  // description follows the picker so the user can read a scenario before switching to it.
  const shown = walkthrough.scenario ?? selected;
  const showTokenStep = shown?.expected === "accepted";
  const showRevocationSteps = shown?.key === "valid";

  const canIssue = scenarios.length > 0;
  const canDiscover = !!walkthrough.certId;
  const discoveryOk = !!walkthrough.discovery && discoveryPassed(walkthrough.discovery.checks);
  const canRegister = discoveryOk;
  const canRequestToken = walkthrough.registration?.outcome === "accepted";
  const canAccess = walkthrough.tokenBefore?.outcome === "issued";
  const canConfirmRevoked = walkthrough.tokenBefore?.outcome === "issued";
  const canVerify =
    walkthrough.revokedConfirmed &&
    walkthrough.registration?.outcome === "accepted" &&
    walkthrough.tokenBefore?.outcome === "issued";

  const registrationJudgement =
    walkthrough.scenario && walkthrough.registration
      ? judgeTrustOutcome(walkthrough.scenario, walkthrough.registration)
      : undefined;

  const headerCount = namedHeaders(walkthrough.headers).length;
  const proxyStatus =
    (walkthrough.proxy.resourceServer || walkthrough.proxy.authorizationServer
      ? "Requests go through the proxy"
      : "No proxy. Requests go straight to the servers") +
    (headerCount > 0 ? `, with ${headerCount} custom header${headerCount !== 1 ? "s" : ""}.` : ".");

  const setup = (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Box sx={FIELD_GRID}>
            <TextField
              label="FHIR server"
              value={fhirDraft}
              onChange={(e) => setFhirDraft(e.target.value)}
              onBlur={commitFhirServer}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitFhirServer();
                }
              }}
              fullWidth
              helperText="Discovered, registered with, and read from"
            />
            <TextField
              label="Security server"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitServerUrl}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitServerUrl();
                }
              }}
              fullWidth
              helperText="FAST Security RI that issues and revokes the certificate"
              sx={{ gridColumn: "span 2" }}
            />
          </Box>
          <Box>
            <ButtonBase
              onClick={() => setProxyOpen(!proxyOpen)}
              aria-expanded={proxyOpen}
              sx={{
                width: "100%",
                justifyContent: "space-between",
                textAlign: "left",
                mx: -1,
                px: 1,
                py: 0.75,
                boxSizing: "content-box",
                borderRadius: 1,
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Box>
                <Typography variant="subtitle2">Proxy and custom headers</Typography>
                <Typography variant="body2" color="text.secondary">
                  {proxyStatus}
                </Typography>
              </Box>
              <ExpandMore sx={{ color: "text.secondary", transform: proxyOpen ? "rotate(180deg)" : "none" }} />
            </ButtonBase>
            <Collapse in={proxyOpen}>
              <Stack spacing={2} sx={{ pt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Optional. Sends discovery, registration, token, and resource requests through a forwarding proxy
                  such as Touchstone.
                </Typography>
                <Box sx={FIELD_GRID}>
                  <TextField
                    size="small"
                    label="Resource server proxy URL"
                    value={walkthrough.proxy.resourceServer}
                    onChange={(e) => update({ proxy: { ...walkthrough.proxy, resourceServer: e.target.value } })}
                    fullWidth
                  />
                  <TextField
                    size="small"
                    label="Authorization server proxy URL"
                    value={walkthrough.proxy.authorizationServer}
                    onChange={(e) => update({ proxy: { ...walkthrough.proxy, authorizationServer: e.target.value } })}
                    fullWidth
                  />
                  <span />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Custom headers go on every discovery, registration, token, and resource request, with or without a
                  proxy. They stay in this browser&apos;s local storage.
                </Typography>
                <Box sx={FIELD_GRID}>
                  {walkthrough.headers.map((header, index) => (
                    <React.Fragment key={index}>
                      <TextField
                        size="small"
                        label="Header name"
                        placeholder="USER_KEY"
                        value={header.name}
                        onChange={(e) => {
                          const headers = [...walkthrough.headers];
                          headers[index] = { ...headers[index], name: e.target.value };
                          update({ headers });
                        }}
                        fullWidth
                      />
                      <TextField
                        size="small"
                        label="Header value"
                        value={header.value}
                        onChange={(e) => {
                          const headers = [...walkthrough.headers];
                          headers[index] = { ...headers[index], value: e.target.value };
                          update({ headers });
                        }}
                        fullWidth
                      />
                      <IconButton
                        size="small"
                        aria-label="Remove header"
                        onClick={() =>
                          update({ headers: walkthrough.headers.filter((_, i) => i !== index) })
                        }
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </React.Fragment>
                  ))}
                </Box>
                <Box>
                  <Button
                    size="small"
                    startIcon={<Add />}
                    onClick={() => update({ headers: [...walkthrough.headers, { name: "", value: "" }] })}
                  >
                    Add header
                  </Button>
                </Box>
              </Stack>
            </Collapse>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader icon={<Block />} title="Certificate Scenario Walkthrough" tag="Testing" color="success" />
      {showRevocationSteps && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Step 6 needs an IdP admin login (admin or udap).
        </Alert>
      )}
      <Stack spacing={3}>
        {setup}
        <Card>
          <CardContent sx={{ position: "relative" }}>
            <Button
              size="small"
              variant="contained"
              onClick={() => resetTo(walkthrough.serverUrl)}
            >
              Start over
            </Button>
            <Stepper activeStep={walkthrough.activeStep} orientation="vertical">
              <Step expanded completed={!!walkthrough.certId}>
                <StepLabel>Issue a certificate</StepLabel>
                <StepContent>
                  <Stack spacing={1}>
                    <TextField
                      select
                      label="Scenario"
                      value={scenarios.length > 0 ? selectedKey : ""}
                      onChange={(e) => setSelectedKey(e.target.value)}
                      fullWidth
                    >
                      {scenarios.map((s) => (
                        <MenuItem key={s.key} value={s.key}>
                          {s.title}
                        </MenuItem>
                      ))}
                    </TextField>
                    {selected && <ScenarioDescription scenario={selected} />}
                    <ErrorAlert message={loadError} />
                    <StepButtonRow
                      label="Issue certificate"
                      busy={busy}
                      running={running === "issue"}
                      disabled={!canIssue}
                      hint={canIssue ? undefined : "Waiting for the scenario catalog to load."}
                      onClick={issueCertificate}
                    />
                    <ErrorAlert message={errorFor("issue")} />
                    {walkthrough.certId && walkthrough.certificate && walkthrough.serial && walkthrough.pfx && walkthrough.scenario && (
                      <IssueCertificateResult
                        serial={walkthrough.serial}
                        password={walkthrough.password ?? ""}
                        pfx={walkthrough.pfx}
                        certificate={walkthrough.certificate}
                        scenarioKey={walkthrough.scenario.key}
                      />
                    )}
                  </Stack>
                </StepContent>
              </Step>

              <Step expanded completed={discoveryOk}>
                <StepLabel>Discover the authorization server</StepLabel>
                <StepContent>
                  <Stack spacing={1}>
                    <StepButtonRow
                      label="Discover"
                      busy={busy}
                      running={running === "discover"}
                      disabled={!canDiscover}
                      hint={canDiscover ? undefined : "Issue a certificate first."}
                      onClick={discover}
                    />
                    <ErrorAlert message={errorFor("discover")} />
                    {walkthrough.discovery && walkthrough.securityServerCheck && (
                      <DiscoveryResult discovery={walkthrough.discovery} securityServerCheck={walkthrough.securityServerCheck} />
                    )}
                  </Stack>
                </StepContent>
              </Step>

              <Step expanded completed={registrationJudgement?.result === "pass"}>
                <StepLabel>Register a client</StepLabel>
                <StepContent>
                  <Stack spacing={1}>
                    <StepButtonRow
                      label="Register"
                      busy={busy}
                      running={running === "register"}
                      disabled={!canRegister}
                      hint={canRegister ? undefined : "Run discovery first."}
                      onClick={registerClient}
                    />
                    <ErrorAlert message={errorFor("register")} />
                    {walkthrough.registration && registrationJudgement && (
                      <RegisterResult registration={walkthrough.registration} judgement={registrationJudgement} />
                    )}
                  </Stack>
                </StepContent>
              </Step>

              {showTokenStep && (
                <Step expanded completed={walkthrough.tokenBefore?.outcome === "issued"}>
                  <StepLabel>Request an access token</StepLabel>
                  <StepContent>
                    <Stack spacing={1}>
                      <StepButtonRow
                        label="Request token"
                        busy={busy}
                        running={running === "token"}
                        disabled={!canRequestToken}
                        hint={canRequestToken ? undefined : "Register a client first."}
                        onClick={requestTokenBefore}
                      />
                      <ErrorAlert message={errorFor("token")} />
                      {walkthrough.tokenBefore && <TokenBeforeResult token={walkthrough.tokenBefore} />}
                    </Stack>
                  </StepContent>
                </Step>
              )}

              {showTokenStep && (
                <Step expanded completed={!!walkthrough.access && judgeAccess(walkthrough.access).result === "pass"}>
                  <StepLabel>Access a resource</StepLabel>
                  <StepContent>
                    <Stack spacing={1}>
                      <StepButtonRow
                        label="Read a Patient"
                        busy={busy}
                        running={running === "access"}
                        disabled={!canAccess}
                        hint={canAccess ? undefined : "Request an access token first."}
                        onClick={accessResource}
                      />
                      <ErrorAlert message={errorFor("access")} />
                      {walkthrough.access && <AccessResult access={walkthrough.access} />}
                    </Stack>
                  </StepContent>
                </Step>
              )}

              {showRevocationSteps && (
                <Step expanded completed={walkthrough.revokedConfirmed}>
                  <StepLabel>Revoke the certificate on the IdP</StepLabel>
                  <StepContent>
                    <Stack spacing={1}>
                      <RevokeInstructions
                        revocationsUrl={walkthrough.serverUrl + "/udap/revocations"}
                        password={walkthrough.password}
                      />
                      <StepButtonRow
                        label="I revoked it, continue"
                        busy={false}
                        disabled={!canConfirmRevoked}
                        hint={canConfirmRevoked ? undefined : "Request an access token first."}
                        onClick={confirmRevoked}
                      />
                    </Stack>
                  </StepContent>
                </Step>
              )}

              {showRevocationSteps && (
                <Step expanded completed={walkthrough.tokenAfter !== undefined && walkthrough.registrationAfter !== undefined}>
                  <StepLabel>Prove the certificate is rejected</StepLabel>
                  <StepContent>
                    <Stack spacing={1}>
                      <StepButtonRow
                        label="Verify"
                        busy={busy}
                        running={running === "verify"}
                        disabled={!canVerify}
                        hint={canVerify ? undefined : "Confirm the revocation above first."}
                        onClick={verify}
                      />
                      <ErrorAlert message={errorFor("verify")} />
                      <VerifyResult tokenAfter={walkthrough.tokenAfter} registrationAfter={walkthrough.registrationAfter} />
                    </Stack>
                  </StepContent>
                </Step>
              )}
            </Stepper>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
