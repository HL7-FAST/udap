"use client";

import { Block, ContentCopy, Download } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Link as MuiLink,
  Stack,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import { CertificateFacts } from "@/lib/tests/cert-facts";
import {
  StepJudgement,
  judgeRegistrationAfterRevocation,
  judgeTokenAfterRevocation,
  judgeTokenBeforeRevocation,
} from "@/lib/tests/revocation-outcome";
import { CertScenarioSummary, TrustRunOutcome } from "@/lib/tests/trust-outcome";
import { TokenRunOutcome } from "@/lib/token-outcome";

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

export function StepButtonRow({
  label,
  busy,
  disabled,
  hint,
  onClick,
}: {
  label: string;
  busy: boolean;
  disabled?: boolean;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
      <Button variant="contained" onClick={onClick} disabled={busy || disabled}>
        {label}
      </Button>
      {busy && <CircularProgress size={20} />}
      {!busy && hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Stack>
  );
}

export function JudgementChip({ judgement }: { judgement: StepJudgement }) {
  return (
    <Chip
      label={judgement.result === "pass" ? "Pass" : "Fail"}
      color={judgement.result === "pass" ? "success" : "error"}
      size="small"
    />
  );
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
    <Stack spacing={1} sx={{ mt: 1 }}>
      <Typography variant="body2">Subject: {certificate.subject}</Typography>
      <Typography variant="body2">Issuer: {certificate.issuer}</Typography>
      <Typography variant="body2">Not after: {certificate.notAfter}</Typography>
      <Typography variant="body2">SAN: {certificate.subjectAltNames.join(", ") || "(none)"}</Typography>
      <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
        Serial: {serial}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
        <Button
          startIcon={<Download />}
          variant="outlined"
          size="small"
          onClick={() => downloadPfx(pfx, `${scenarioKey}-walkthrough.pfx`)}
        >
          Download PFX
        </Button>
        <CopyButton value={pfx} label="Copy PFX as base64" />
        <CopyButton value={serial} label="Copy serial" />
        <Typography variant="body2" color="text.secondary">
          Password: <code>{password}</code>
        </Typography>
      </Stack>
    </Stack>
  );
}

/** Keeps scenario explanations consistent with the Certificate Validation page. */
export function ScenarioDescription({ scenario }: { scenario: CertScenarioSummary }) {
  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      <Typography variant="body2">{scenario.summary}</Typography>
      <Typography variant="body2">
        Expected: registration{" "}
        {scenario.expected === "accepted" ? (
          <strong>accepted</strong>
        ) : (
          <>
            <strong>rejected</strong> with error <code>{scenario.expectedError}</code>
          </>
        )}
        .
      </Typography>
      <Stack spacing={0.5}>
        {scenario.references.map((r) => (
          <Typography variant="body2" key={r.url}>
            <MuiLink href={r.url} target="_blank" rel="noopener noreferrer">
              {r.shortLabel}
            </MuiLink>
            : {r.quote}
          </Typography>
        ))}
      </Stack>
    </Stack>
  );
}

export function RegisterResult({ registration }: { registration: TrustRunOutcome }) {
  if (registration.outcome === "accepted") {
    const client = registration.body as { id?: string; scopes?: string[] };
    return (
      <Stack spacing={1} sx={{ mt: 1 }}>
        <Typography variant="body2">Client id: {client.id}</Typography>
        <Typography variant="body2">Granted scopes: {(client.scopes ?? []).join(", ") || "(none)"}</Typography>
      </Stack>
    );
  }
  const body = registration.body as { error?: string; error_description?: string };
  return (
    <Alert severity="error" sx={{ mt: 1 }}>
      {body.error}: {body.error_description}
    </Alert>
  );
}

export function TokenBeforeResult({ token }: { token: TokenRunOutcome }) {
  const judgement = judgeTokenBeforeRevocation(token);
  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <JudgementChip judgement={judgement} />
        <Typography variant="body2">{judgement.message}</Typography>
      </Stack>
      {token.outcome === "issued" && (
        <>
          {token.accessToken && (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
              <CopyButton value={token.accessToken} label="Copy access token" />
              <Typography variant="body2" color="text.secondary">
                Use it as a Bearer token in another client, such as Postman.
              </Typography>
            </Stack>
          )}
          <Typography variant="caption" color="text.secondary">
            Decoded claims
          </Typography>
          <Box component="pre" sx={{ m: 0, p: 1, bgcolor: "action.hover", borderRadius: 1, overflowX: "auto" }}>
            {JSON.stringify(token.claims, null, 2)}
          </Box>
        </>
      )}
    </Stack>
  );
}

export function RevokeInstructions({ revocationsUrl, password }: { revocationsUrl: string; password?: string }) {
  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      <Typography variant="body2">
        Open the{" "}
        <MuiLink href={revocationsUrl} target="_blank" rel="noopener noreferrer">
          IdP revocation page
        </MuiLink>{" "}
        in a new tab, log in as <code>admin</code> or <code>udap</code>, then upload the PFX downloaded in step 1
        (password <code>{password ?? "shown in step 1"}</code>) or paste its serial number. Choose a reason and
        submit.
      </Typography>
    </Stack>
  );
}

export function VerifyResult({
  tokenAfter,
  registrationAfter,
}: {
  tokenAfter?: TokenRunOutcome;
  registrationAfter?: TrustRunOutcome;
}) {
  if (!tokenAfter || !registrationAfter) {
    return null;
  }
  const tokenJudgement = judgeTokenAfterRevocation(tokenAfter);
  const registrationJudgement = judgeRegistrationAfterRevocation(registrationAfter);
  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="subtitle2">Token endpoint</Typography>
          <JudgementChip judgement={tokenJudgement} />
        </Stack>
        <Typography variant="body2">{tokenJudgement.message}</Typography>
        <Box component="pre" sx={{ m: 0, p: 1, bgcolor: "action.hover", borderRadius: 1, overflowX: "auto" }}>
          {JSON.stringify(tokenAfter.outcome === "rejected" ? tokenAfter.body : tokenAfter.claims, null, 2)}
        </Box>
      </Stack>
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="subtitle2">Registration</Typography>
          <JudgementChip judgement={registrationJudgement} />
        </Stack>
        <Typography variant="body2">{registrationJudgement.message}</Typography>
        <Box component="pre" sx={{ m: 0, p: 1, bgcolor: "action.hover", borderRadius: 1, overflowX: "auto" }}>
          {JSON.stringify(registrationAfter.body, null, 2)}
        </Box>
      </Stack>
      <Alert severity="info" icon={<Block fontSize="inherit" />}>
        The IdP log shows the real reason at Debug level: grep for <code>Chain Problem: Revoked</code>.
      </Alert>
    </Stack>
  );
}
