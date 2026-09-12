# Generating Certificates

The server provides an API endpoint for dynamically generating client certificates signed by a configured Certificate Authority (CA).

!!! info "Available Certificate Authorities"
    - **LocalCA** - Default CA for local development
    - **FastCA** - Production CA used by the [hosted instance](https://udap-security.fast.hl7.org)
    - **FhirLabs** - SureFhirLabs CA for interoperability testing

## :material-api: API Endpoint

The certificate generation endpoint accepts POST requests with certificate parameters. To generate a certificate from the hosted instance, use the following endpoint:

```
POST https://udap-security.fast.hl7.org/api/cert/generate
```

!!! note Local Development
    If running the server locally, replace the URL with your local server address (e.g., `https://localhost:5001/api/cert/generate`).

### :material-code-json: Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `altNames` | `string[]` | Yes | List of URIs to include as Subject Alternative Names (SANs), at most 10 |
| `password` | `string` | Yes | Password to protect the private key |
| `provider` | `Local` \| `FhirLabs` | No | CA provider (default: `Local`) |
| `scenario` | `string` | No | Named certificate preset (default: `valid`). See `GET /api/cert/scenarios` for the list. Local provider only. |
| `keyType` | `Rsa` \| `Ecdsa` | No | Key algorithm (default: `Rsa`). `Ecdsa` uses P-384 and signs software statements with ES384. Local provider only. |

### :material-file-certificate: Response

Returns a **PKCS#12 (.pfx/.p12)** file containing:

- :material-certificate: Client certificate
- :material-key: Private key (password protected)
- :material-certificate-outline: Certificate chain

## :material-play-box-multiple: Examples

=== "Local Development"

    Generate a certificate using the `LocalCA` chain (or `FastCA` if using the hosted instance):

    ```json title="Request Body"
    {
      "altNames": [
        "http://localhost:8080/fhir"
      ],
      "password": "udap-test"
    }
    ```

    !!! tip "Local/FAST CA Trust"
        The `LocalCA` and `FastCA` certificates are automatically trusted in the default configuration.

=== "FhirLabs CA"

    Generate a certificate using the SureFhirLabs CA:

    ```json title="Request Body"
    {
      "altNames": [
        "http://localhost:8080/fhir"
      ],
      "password": "udap-test",
      "provider": "FhirLabs"
    }
    ```

    !!! note "UdapEd Compatible"
        Certificates from FhirLabs CA are also compatible with the [UdapEd tool](https://udaped.fhirlabs.net).

## :material-flask: Test Scenarios

The `scenario` parameter issues a deliberately defective certificate for negative testing. `GET /api/cert/scenarios` lists each one with its expected outcome and the IG or UDAP DCR clause it tests.

| Scenario | Defect | Registration |
|----------|--------|--------------|
| `valid` | None | Accepted |
| `expired` | `NotAfter` one day in the past | Rejected, `unapproved_software_statement` |
| `not-yet-valid` | `NotBefore` one day in the future | Rejected, `unapproved_software_statement` |
| `untrusted-root` | Chain ends at a root no community trusts | Rejected, `unapproved_software_statement` |
| `revoked` | Serial added to the intermediate CA's CRL | Rejected, `unapproved_software_statement` |
| `no-cdp` | No CRL distribution point | Accepted, nothing to check |
| `dead-cdp` | CRL distribution point returns 404 | Rejected, `unapproved_software_statement` |
| `missing-san` | No SAN, so `iss` cannot match | Rejected, `invalid_software_statement` |
| `missing-intermediate` | Bundle omits the intermediate | Accepted, the server already trusts it |

`missing-san` fails JWT validation before trust is evaluated, which is why its error code differs (UDAP DCR 5.2).

Where to use it:

- `/scenarios` on the server: pick a scenario and download the bundle, or copy the JSON for `POST /api/cert/generate`.
- `/udap/revocations` (admin): revoke any issued certificate by upload or serial. The CRL under `/certs/<community>/crl/` is rewritten at once.
- Sandbox "Certificate Validation": runs the whole catalog and grades each result.
- Sandbox "Scenario Walkthrough": one scenario, step by step, through issue, register, token, and (for `valid`) revoke and verify.

```json title="Request Body"
{
  "altNames": ["http://localhost:8080/fhir"],
  "password": "udap-test",
  "scenario": "expired"
}
```

## :material-bash: Using cURL

```bash title="Generate and save certificate"
curl -X POST https://udap-security.fast.hl7.org/api/cert/generate \
  -H "Content-Type: application/json" \
  -d '{
    "altNames": ["http://localhost:8080/fhir"],
    "password": "udap-test"
  }' \
  --output mycert.pfx
```
