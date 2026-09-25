"use client";

import { Block, ContentCopy, Download, ExpandLess, ExpandMore } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import type { AccessRunOutcome } from "@/lib/access-outcome";
import { CertificateFacts } from "@/lib/tests/cert-facts";
import { judgeAccess } from "@/lib/tests/access-judge";
import { DiscoveryCheck, DiscoveryOutcome, discoveryPassed } from "@/lib/tests/discovery-outcome";
import {
  judgeRegistrationAfterRevocation,
  judgeTokenAfterRevocation,
  judgeTokenBeforeRevocation,
} from "@/lib/tests/revocation-outcome";
import { CertScenarioSummary, TrustJudgement, TrustRunOutcome } from "@/lib/tests/trust-outcome";
import { TokenRunOutcome } from "@/lib/token-outcome";

type Tone = "pass" | "fail" | "info";

const TONES: Record<Tone, { label: string; chip: "success" | "error" | "default" }> = {
  pass: { label: "Pass", chip: "success" },
  fail: { label: "Fail", chip: "error" },
  info: { label: "Info", chip: "default" },
};

export function downloadPfx(base64: string, filename: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/x-pkcs12" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ErrorAlert({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return <Alert severity="error">{message}</Alert>;
}

/** `busy` disables the button while any step runs. `running` marks this step as the one in flight. */
export function StepButtonRow({
  label,
  busy,
  running = false,
  disabled,
  hint,
  onClick,
}: {
  label: string;
  busy: boolean;
  running?: boolean;
  disabled?: boolean;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
      <Button variant="contained" onClick={onClick} disabled={busy || disabled}>
        {label}
      </Button>
      {running && <CircularProgress size={20} />}
      {!running && hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Stack>
  );
}

export function JudgementChip({ judgement }: { judgement: { result: Tone } }) {
  const tone = TONES[judgement.result];
  return <Chip label={tone.label} color={tone.chip} size="small" />;
}

/** Labelled copy button. The label flips to "Copied" briefly so the click has visible feedback. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      startIcon={<ContentCopy />}
      variant="outlined"
      size="small"
      color={copied ? "success" : "primary"}
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}

/**
 * Frame for a step's outcome. The verdict sits in the header, facts and actions below, so the eye
 * lands on pass or fail first and the raw details never compete with the button that produced them.
 */
export function ResultPanel({
  tone,
  chipLabel,
  title,
  children,
}: {
  tone: Tone;
  chipLabel?: string;
  title: string;
  children?: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <Paper variant="outlined" square sx={{ mt: 1, p: 1.5 }}>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Chip label={chipLabel ?? t.label} color={t.chip} size="small" />
          <Typography variant="subtitle2">{title}</Typography>
        </Stack>
        {children}
      </Stack>
    </Paper>
  );
}

export interface Fact {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

/** Two-column label and value list, so identifiers and names read as data instead of prose. */
export function FactList({ facts }: { facts: Fact[] }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 2, rowGap: 0.5, alignItems: "baseline" }}>
      {facts.map((fact) => (
        <React.Fragment key={fact.label}>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
            {fact.label}
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: fact.mono ? "monospace" : undefined, overflowWrap: "anywhere" }}>
            {fact.value}
          </Typography>
        </React.Fragment>
      ))}
    </Box>
  );
}

/** Buttons the user can act on, kept apart from the facts by a rule. */
export function ActionRow({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Divider />
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
        {children}
      </Stack>
    </>
  );
}

/** One-line summary with detail collapsed behind it, so a step's result reads at a glance. */
export function CollapsedDetails({
  summary,
  label,
  children,
}: {
  summary: string;
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
        <Typography variant="body2" color="text.secondary">
          {summary}
        </Typography>
        <Button size="small" onClick={() => setOpen(!open)} endIcon={open ? <ExpandLess /> : <ExpandMore />}>
          {open ? "Hide " + label : "Show " + label}
        </Button>
      </Stack>
      <Collapse in={open} unmountOnExit>
        {children}
      </Collapse>
    </Stack>
  );
}

export function JsonDetails({ summary, value }: { summary: string; value: unknown }) {
  return (
    <CollapsedDetails summary={summary} label="JSON">
      <Box component="pre" sx={{ m: 0, p: 1, bgcolor: "action.hover", borderRadius: 1, overflowX: "auto", fontSize: 13 }}>
        {JSON.stringify(value, null, 2)}
      </Box>
    </CollapsedDetails>
  );
}

function CheckRows({ checks }: { checks: DiscoveryCheck[] }) {
  return (
    <Stack spacing={0.75}>
      {checks.map((check) => (
        <Stack key={check.name} direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <JudgementChip judgement={check} />
          <Typography variant="body2">{check.message}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function hostOf(url: unknown): string {
  try {
    return new URL(String(url)).host;
  } catch {
    return "(unknown)";
  }
}

function errorField(body: unknown, field: "error" | "error_description"): string | undefined {
  if (body && typeof body === "object" && field in body) {
    const value = (body as Record<string, unknown>)[field];
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

function errorFacts(status: number | undefined, body: unknown): Fact[] {
  return [
    { label: "HTTP status", value: status ?? "?" },
    { label: "Error", value: errorField(body, "error") ?? "(none)", mono: true },
    { label: "Description", value: errorField(body, "error_description") ?? "(none)" },
  ];
}

function claimFacts(claims: Record<string, unknown>): Fact[] {
  const exp = typeof claims.exp === "number" ? new Date(claims.exp * 1000).toLocaleTimeString() : "unknown";
  return [
    { label: "Client id", value: String(claims.client_id ?? "?"), mono: true },
    { label: "Scope", value: String(claims.scope ?? "(none)"), mono: true },
    { label: "Expires", value: exp },
  ];
}

export function IssueCertificateResult({
  serial,
  password,
  pfx,
  certificate,
  scenarioKey,
}: {
  serial: string;
  password: string;
  pfx: string;
  certificate: CertificateFacts;
  scenarioKey: string;
}) {
  return (
    <ResultPanel tone="info" chipLabel="Issued" title="Certificate issued for this walkthrough">
      <FactList
        facts={[
          { label: "Subject", value: certificate.subject },
          { label: "Issuer", value: certificate.issuer },
          { label: "SAN", value: certificate.subjectAltNames.join(", ") || "(none)", mono: true },
          { label: "Not after", value: certificate.notAfter },
          { label: "Serial", value: serial, mono: true },
          { label: "Password", value: password, mono: true },
        ]}
      />
      <ActionRow>
        <Button startIcon={<Download />} variant="outlined" size="small" onClick={() => downloadPfx(pfx, `${scenarioKey}-walkthrough.pfx`)}>
          Download PFX
        </Button>
        <CopyButton value={pfx} label="Copy PFX as base64" />
        <CopyButton value={serial} label="Copy serial" />
      </ActionRow>
    </ResultPanel>
  );
}

/** Keeps scenario explanations consistent with the Certificate Validation page. */
export function ScenarioDescription({ scenario }: { scenario: CertScenarioSummary }) {
  const expected =
    scenario.expected === "accepted" ? "Expected: registration accepted" : `Expected: rejected with ${scenario.expectedError}`;
  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      <Typography variant="body2">{scenario.summary}</Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
        <Chip label={expected} size="small" color={scenario.expected === "accepted" ? "success" : "error"} variant="outlined" />
      </Stack>
      <CollapsedDetails summary={`${scenario.references.length} specification references.`} label="references">
        <Stack spacing={0.5} sx={{ pt: 0.5 }}>
          {scenario.references.map((r) => (
            <Typography variant="body2" key={r.url}>
              <MuiLink href={r.url} target="_blank" rel="noopener noreferrer">
                {r.shortLabel}
              </MuiLink>
              : {r.quote}
            </Typography>
          ))}
        </Stack>
      </CollapsedDetails>
    </Stack>
  );
}

/** Failed and info checks stay visible. The full check list and the raw well-known document each collapse separately. */
export function DiscoveryResult({
  discovery,
  securityServerCheck,
}: {
  discovery: DiscoveryOutcome;
  securityServerCheck: DiscoveryCheck;
}) {
  const passed = discovery.checks.filter((c) => c.result === "pass").length;
  const attention = discovery.checks.filter((c) => c.result !== "pass");
  const ok = discoveryPassed(discovery.checks);
  return (
    <ResultPanel tone={ok ? "pass" : "fail"} title={ok ? "Metadata is conformant, the client can proceed" : "Metadata failed a required check, the client stops here"}>
      {attention.length > 0 && <CheckRows checks={attention} />}
      <Alert severity={securityServerCheck.result === "fail" ? "warning" : "success"} variant="outlined" sx={{ py: 0 }}>
        {securityServerCheck.message}
      </Alert>
      <FactList
        facts={[
          { label: "Authorization server", value: hostOf(discovery.metadata.registration_endpoint) },
          { label: "Registration", value: discovery.metadata.registration_endpoint ?? "(none)", mono: true },
          { label: "Token", value: discovery.metadata.token_endpoint ?? "(none)", mono: true },
        ]}
      />
      <CollapsedDetails summary={`${passed} of ${discovery.checks.length} checks passed.`} label="checks">
        <Box sx={{ pt: 0.5 }}>
          <CheckRows checks={discovery.checks} />
        </Box>
      </CollapsedDetails>
      <JsonDetails summary="Well-known metadata as served." value={discovery.metadata} />
    </ResultPanel>
  );
}

export function RegisterResult({ registration, judgement }: { registration: TrustRunOutcome; judgement: TrustJudgement }) {
  if (registration.outcome === "accepted") {
    const client = registration.body as { id?: string; scopes?: string[] };
    return (
      <ResultPanel tone={judgement.result} title={judgement.message}>
        <FactList
          facts={[
            { label: "Client id", value: client.id ?? "?", mono: true },
            { label: "Granted scopes", value: (client.scopes ?? []).join(", ") || "(none)", mono: true },
          ]}
        />
      </ResultPanel>
    );
  }
  return (
    <ResultPanel tone={judgement.result} title={judgement.message}>
      <FactList facts={errorFacts(registration.status, registration.body)} />
      <JsonDetails summary="Registration error response." value={registration.body} />
    </ResultPanel>
  );
}

export function TokenBeforeResult({ token }: { token: TokenRunOutcome }) {
  const judgement = judgeTokenBeforeRevocation(token);
  if (token.outcome !== "issued") {
    return (
      <ResultPanel tone={judgement.result} title={judgement.message}>
        <FactList facts={errorFacts(token.status, token.body)} />
        <JsonDetails summary="Token error response." value={token.body} />
      </ResultPanel>
    );
  }
  return (
    <ResultPanel tone={judgement.result} title={judgement.message}>
      <FactList facts={claimFacts(token.claims)} />
      <JsonDetails summary="Decoded access token claims." value={token.claims} />
      {token.accessToken && (
        <ActionRow>
          <CopyButton value={token.accessToken} label="Copy access token" />
          <Typography variant="caption" color="text.secondary">
            Use it as a Bearer token in another client, such as Postman.
          </Typography>
        </ActionRow>
      )}
    </ResultPanel>
  );
}

function accessSummary(access: AccessRunOutcome): string {
  const body = access.body as { resourceType?: unknown; entry?: unknown[] } | null;
  if (body && typeof body === "object" && body.resourceType === "Bundle") {
    const count = (body.entry ?? []).length;
    return `Bundle with ${count} matching resource${count !== 1 ? "s" : ""}`;
  }
  return body && typeof body === "object" && body.resourceType ? String(body.resourceType) : "(no FHIR resource)";
}

/** Shows the routed URL so the user can see which host, real server or test proxy, was hit. */
export function AccessResult({ access }: { access: AccessRunOutcome }) {
  const judgement = judgeAccess(access);
  return (
    <ResultPanel tone={judgement.result} title={judgement.message}>
      <FactList
        facts={[
          { label: "Requested", value: access.url, mono: true },
          { label: "HTTP status", value: access.status },
          { label: "Response", value: accessSummary(access) },
        ]}
      />
      <JsonDetails summary="Response body." value={access.body} />
    </ResultPanel>
  );
}

export function RevokeInstructions({ revocationsUrl, password }: { revocationsUrl: string; password?: string }) {
  return (
    <Box component="ol" sx={{ m: 0, pl: 3, "& li": { mb: 0.5 } }}>
      <Typography component="li" variant="body2">
        Open the{" "}
        <MuiLink href={revocationsUrl} target="_blank" rel="noopener noreferrer">
          IdP revocation page
        </MuiLink>{" "}
        in a new tab and log in as <code>admin</code> or <code>udap</code>.
      </Typography>
      <Typography component="li" variant="body2">
        Upload the PFX from step 1 (password <code>{password ?? "shown in step 1"}</code>) or paste its serial number.
      </Typography>
      <Typography component="li" variant="body2">
        Choose a reason, submit, then come back here.
      </Typography>
    </Box>
  );
}

export function VerifyResult({
  tokenAfter,
  registrationAfter,
}: {
  tokenAfter?: TokenRunOutcome;
  registrationAfter?: TrustRunOutcome;
}) {
  if (!registrationAfter) {
    return null;
  }
  const tokenJudgement = tokenAfter ? judgeTokenAfterRevocation(tokenAfter) : undefined;
  const registrationJudgement = judgeRegistrationAfterRevocation(registrationAfter);
  return (
    <Stack spacing={1}>
      {tokenAfter && tokenJudgement && (
        <ResultPanel tone={tokenJudgement.result} title={`Token endpoint: ${tokenJudgement.message}`}>
          <FactList facts={tokenAfter.outcome === "rejected" ? errorFacts(tokenAfter.status, tokenAfter.body) : claimFacts(tokenAfter.claims)} />
          <JsonDetails summary="Token endpoint response." value={tokenAfter.outcome === "rejected" ? tokenAfter.body : tokenAfter.claims} />
        </ResultPanel>
      )}
      <ResultPanel tone={registrationJudgement.result} title={`Registration: ${registrationJudgement.message}`}>
        <FactList
          facts={
            registrationAfter.outcome === "rejected"
              ? errorFacts(registrationAfter.status, registrationAfter.body)
              : [{ label: "Outcome", value: "Registration accepted" }]
          }
        />
        <JsonDetails summary="Registration response." value={registrationAfter.body} />
      </ResultPanel>
      <Alert severity="info" icon={<Block fontSize="inherit" />}>
        The IdP log shows the real reason at Debug level: grep for <code>Chain Problem: Revoked</code>.
      </Alert>
    </Stack>
  );
}
