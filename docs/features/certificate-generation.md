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
| `altNames` | `string[]` | Yes | List of URIs to include as Subject Alternative Names (SANs) |
| `password` | `string` | Yes | Password to protect the private key |
| `provider` | `Local` \| `FhirLabs` | No | CA provider (default: `Local`) |

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
