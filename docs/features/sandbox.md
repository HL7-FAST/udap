# Sandbox App

The Docker image serves the Next.js sandbox from `examples/sandbox` at `/sandbox`. IdentityServer starts the Node server on `127.0.0.1:3000`, restarts it if it exits, and forwards `/sandbox/*` to it. Off unless `AppConfig:SandboxEnabled` is `true`. `docker-compose.yml` turns it on.

## Configuration

The sandbox URL is `{UdapIdpBaseUrl}/sandbox`. Everything else derives from it, so localhost and a public host differ by that one setting.

| Property | Default | Purpose |
|----------|---------|---------|
| `SandboxEnabled` | `false` (`true` in the image) | Start Node and map `/sandbox` |
| `SandboxFhirServerUrl` | `https://identity-matching.fast.hl7.org/fhir` | FHIR server whose `/.well-known/udap` names the authorization server the default clients register with |
| `SandboxAuthSecret` | random per start | Auth.js session secret |
| `SandboxCertFile` | (minted at start) | Client certificate, path or base64 PKCS#12. Minted from the local CA with SANs `{sandbox URL}/#SAN1` and `#SAN2` when empty |
| `SandboxCertPassword` | `udap-test` | Password for `SandboxCertFile` |

## FHIR server reachability

Metadata fetches and `client_credentials` queries run inside the container. The `authorization_code` pages call the FHIR server from the browser with the user's token, so that server must also be reachable from the browser, over HTTPS when the sandbox is. Compose defaults to `http://host.docker.internal:8080/fhir`, a local FHIR server that names `https://localhost:5001` as its authorization server. That covers registration, login and the `client_credentials` pages. The signed-in pages call it from the browser, which blocks plain HTTP from an HTTPS page for any host but localhost, so for those run the sandbox standalone with `bun dev`. Override with `SANDBOX_FHIR_SERVER_URL`.

## Path base

Next.js inlines its base path at build time. With `AppConfig:PathBase` set, build with the full external path:

```sh
SANDBOX_BASE_PATH=/udap/sandbox docker compose build
```

The server logs an error at startup if the built path does not equal `{PathBase}/sandbox`.

## Public hosts

- The container calls its own public URL. The host must allow that loopback.
- The sandbox API routes are unauthenticated and fetch any server URL the user types.
- Registered clients and tokens are in memory and reset on restart.

## Local run

```sh
docker compose up --build
```

Open <https://localhost:5001/sandbox>.
