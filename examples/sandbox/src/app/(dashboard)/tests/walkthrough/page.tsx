"use client";

import { Block } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
  ErrorAlert,
  IssueCertificateResult,
  JudgementChip,
  RegisterResult,
  RevokeInstructions,
  ScenarioDescription,
  StepButtonRow,
  TokenBeforeResult,
  VerifyResult,
} from "./steps";
import { BASE_PATH } from "@/lib/constants";
import PageHeader from "@/components/page-header";
import { UdapClient } from "@/lib/models";
import { CertificateFacts } from "@/lib/tests/cert-facts";
import { judgeTokenBeforeRevocation } from "@/lib/tests/revocation-outcome";
import { CertScenarioSummary, TrustRunOutcome, judgeTrustOutcome } from "@/lib/tests/trust-outcome";
import { TokenRunOutcome } from "@/lib/token-outcome";
import { useUdapClientState } from "@/lib/states";
import { useLocalStorageState } from "@/lib/use-local-storage-state";

const STORE_KEY = "scenario-walkthrough";
const DEFAULT_SERVER_URL = "https://localhost:5001";

export interface WalkthroughState {
  serverUrl: string;
  activeStep: number;
  revokedConfirmed: boolean;
  scenario?: CertScenarioSummary;
  certId?: string;
  pfx?: string;
  password?: string;
  serial?: string;
  certificate?: CertificateFacts;
  client?: UdapClient;
  registration?: TrustRunOutcome;
  tokenBefore?: TokenRunOutcome;
  tokenAfter?: TokenRunOutcome;
  registrationAfter?: TrustRunOutcome;
}

function initialState(serverUrl: string): WalkthroughState {
  return { serverUrl, activeStep: 0, revokedConfirmed: false };
}

const storageCodec = {
  parse: (raw: string): WalkthroughState => {
    try {
      return JSON.parse(raw) as WalkthroughState;
    } catch {
      return initialState(DEFAULT_SERVER_URL);
    }
  },
  stringify: (value: WalkthroughState) => JSON.stringify(value),
};

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
    initialState(initialServerUrl),
    { codec: storageCodec },
  );
  const walkthrough = state ?? initialState(initialServerUrl);

  const [draft, setDraft] = useState(initialServerUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setState(initialState(serverUrl));
    setError(null);
    // The catalog effect only refetches on a new server URL, so a same-server reset keeps the
    // loaded catalog. Clearing it here would leave Issue disabled with nothing to reload it.
    if (serverUrl !== walkthrough.serverUrl) {
      setScenarios([]);
      setLoadError(null);
    }
    // A reset while a request is in flight orphans it (the runId guard drops its result), so
    // nothing will ever flip busy back off on its own.
    setBusy(false);
  }

  function commitServerUrl() {
    const url = draft.trim();
    if (url && url !== walkthrough.serverUrl) {
      resetTo(url);
    }
  }

  async function runStep<T>(fn: () => Promise<T>): Promise<T | undefined> {
    const runId = runIdRef.current;
    setBusy(true);
    setError(null);
    try {
      const value = await fn();
      return runIdRef.current === runId ? value : undefined;
    } catch (e) {
      if (runIdRef.current === runId) {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
      return undefined;
    } finally {
      if (runIdRef.current === runId) {
        setBusy(false);
      }
    }
  }

  const issueCertificate = async () => {
    const scenario = scenarios.find((s) => s.key === selectedKey);
    if (!scenario) {
      return;
    }
    const result = await runStep(() =>
      postStep<{ certId: string; pfx: string; password: string; serial: string; certificate: CertificateFacts }>({
        serverUrl: walkthrough.serverUrl,
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
      client: undefined,
      registration: undefined,
      tokenBefore: undefined,
      tokenAfter: undefined,
      registrationAfter: undefined,
      revokedConfirmed: false,
      activeStep: 1,
    });
  };

  const registerClient = async () => {
    const result = await runStep(() =>
      postStep<{ registration: TrustRunOutcome }>({
        serverUrl: walkthrough.serverUrl,
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
      tokenAfter: undefined,
      registrationAfter: undefined,
      revokedConfirmed: false,
      ...(accepted ? { activeStep: 2 } : {}),
    });
  };

  const requestTokenBefore = async () => {
    const result = await runStep(() =>
      postStep<{ token: TokenRunOutcome }>({
        serverUrl: walkthrough.serverUrl,
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
      tokenAfter: undefined,
      registrationAfter: undefined,
      revokedConfirmed: false,
      ...(advance ? { activeStep: 3 } : {}),
    });
  };

  const confirmRevoked = () => {
    update({ revokedConfirmed: true, activeStep: 4 });
  };

  const verify = async () => {
    const result = await runStep(async () => {
      const tokenResult = await postStep<{ token: TokenRunOutcome }>({
        serverUrl: walkthrough.serverUrl,
        action: "token",
        certId: walkthrough.certId,
        clientId: walkthrough.client?.id,
      });
      const registrationResult = await postStep<{ registration: TrustRunOutcome }>({
        serverUrl: walkthrough.serverUrl,
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
  const canRegister = !!walkthrough.certId;
  const canRequestToken = walkthrough.registration?.outcome === "accepted";
  const canConfirmRevoked = walkthrough.tokenBefore?.outcome === "issued";
  const canVerify =
    walkthrough.revokedConfirmed &&
    walkthrough.registration?.outcome === "accepted" &&
    walkthrough.tokenBefore?.outcome === "issued";

  const registrationJudgement =
    walkthrough.scenario && walkthrough.registration
      ? judgeTrustOutcome(walkthrough.scenario, walkthrough.registration)
      : undefined;

  const setup = (
    <Card>
      <CardContent>
        <Stack direction="column" spacing={2}>
          <TextField
            label="UDAP server"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitServerUrl}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitServerUrl();
              }
            }}
            fullWidth
            helperText="Base URL of the FAST Security RI that issues, registers, and revokes the certificate"
          />
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={() => resetTo(walkthrough.serverUrl)}>
              Start over
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader icon={<Block />} title="Certificate Scenario Walkthrough" tag="Testing" color="success" />
      {showRevocationSteps && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Step 4 needs an IdP admin login (admin or udap).
        </Alert>
      )}
      <Stack spacing={3}>
        {setup}
        <Card>
          <CardContent>
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
                      disabled={!canIssue}
                      hint={canIssue ? undefined : "Waiting for the scenario catalog to load."}
                      onClick={issueCertificate}
                    />
                    <ErrorAlert message={error} />
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

              <Step expanded completed={registrationJudgement?.result === "pass"}>
                <StepLabel>Register a client</StepLabel>
                <StepContent>
                  <Stack spacing={1}>
                    <StepButtonRow
                      label="Register"
                      busy={busy}
                      disabled={!canRegister}
                      hint={canRegister ? undefined : "Issue a certificate first."}
                      onClick={registerClient}
                    />
                    <ErrorAlert message={error} />
                    {walkthrough.registration && registrationJudgement && (
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <JudgementChip judgement={registrationJudgement} />
                          <Typography variant="body2">{registrationJudgement.message}</Typography>
                        </Stack>
                        <RegisterResult registration={walkthrough.registration} />
                      </Stack>
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
                        disabled={!canRequestToken}
                        hint={canRequestToken ? undefined : "Register a client first."}
                        onClick={requestTokenBefore}
                      />
                      <ErrorAlert message={error} />
                      {walkthrough.tokenBefore && <TokenBeforeResult token={walkthrough.tokenBefore} />}
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
                        disabled={!canVerify}
                        hint={canVerify ? undefined : "Confirm the revocation above first."}
                        onClick={verify}
                      />
                      <ErrorAlert message={error} />
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
