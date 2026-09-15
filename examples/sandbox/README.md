# UDAP Sandbox Application

This is a basic testing application that demonstrates registering two UDAP clients and querying a FHIR server using both the `authorization_code` and `client_credentials` grant types.

The application is built with [Next.js](https://nextjs.org/) and uses [NextAuth.js](https://next-auth.js.org/) for client side authentication.


## Requirements
- Node.js v22 or later
- A package manager such as bun, npm, or pnpm (tested with bun)

## Getting Started


### Configuration

The application can be configured using environment variables. You can create a `.env` file in the root of the project based on the provided `.env.example` file.  The `.env.example` file actually contains valid settings for local development, so you could just copy it to `.env` and use it as is for local testing.

The following environment variables are used:

- `NODE_TLS_REJECT_UNAUTHORIZED`: Set to `0` to disable SSL verification for local development.
- `AUTH_SECRET`: A secret used by NextAuth.js for encrypting session data. You can generate a secret by running `npx auth secret`.
- `CERT_FILE`: Path to the p12 certificate for the default server clients OR base64 encoded certificate.
- `CERT_PASSWORD`: Password for the certificate.
- `FHIR_SERVER_URL`: (optional) FHIR server to query.
- `APP_URL`: (optional) URL of this application.

The sandbox is a local testing tool. Its API routes are unauthenticated, they fetch whichever UDAP server the user configures, and TLS verification is disabled by the setting above, so do not expose the sandbox to an untrusted network.

### Certificate Note

A default certificate (`cert-localhost3000-2sans.pfx`) is provided for local development that contains two different SANs (`http://localhost:3000/#SAN1` and `http://localhost:3000/#SAN2`) to enable to default registration of two different clients using the same certificate.

This certificate will work with the FAST Security RI server with its trusted `LocalCA` anchor that it loads by default.

### Running Inside the Security Server Image

The security server's Docker image builds this app with `NEXT_PUBLIC_BASE_PATH=/sandbox` and serves it at `https://<server>/sandbox`. The server process sets `APP_URL`, `AUTH_URL`, `CERT_FILE`, `CERT_PASSWORD`, `AUTH_SECRET` and `FHIR_SERVER_URL` for the Node child, so no `.env` file is needed there. See `docs/features/sandbox.md` in the repository root.

`NEXT_PUBLIC_BASE_PATH` is inlined at build time. Leave it unset for local development.

### Running the Application

Install dependencies:

```sh
bun i
# or
npm i
```

Run the development server:

```sh
bun dev
# or
npm run dev
```

Run in production mode:

```sh
bun run build
bun start
```

## Features

The `authorization_code` flow can be tested by running the application, logging in, and navigating to the "Patients" page.

The `client_credentials` flow can be tested by navigating to the "FHIR Query" page, where you can enter FHIR queries that will be executed using the `client_credentials` UDAP client.

There is also a basic testing suite that can test client registration and has a small set of tests for scope negotiation.

Two pages under Testing exercise the server's certificate scenario catalog (`GET /api/cert/scenarios`):

- "Certificate Validation" runs every scenario and grades each registration against the expected result.
- "Scenario Walkthrough" runs one scenario step by step: issue, register, token, and for `valid` revoke on the IdP and verify rejection.