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

### Certificate Note

A default certificate (`cert-localhost3000-2sans.pfx`) is provided for local development that contains two different SANs (`http://localhost:3000/#SAN1` and `http://localhost:3000/#SAN2`) to enable to default registration of two different clients using the same certificate.

This certificate will work with the FAST Security RI server with its trusted `LocalCA` anchor that it loads by default.

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