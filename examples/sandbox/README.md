# UDAP Sandbox Application

This is a basic testing application that demonstrates registering two UDAP clients and querying a FHIR server using both the `authorization_code` and `client_credentials` grant types.

The application is built with [Next.js](https://nextjs.org/) and uses [NextAuth.js](https://next-auth.js.org/) for client side authentication.


## Requirements
- Node.js v22 or later
- A package manager such as bun, npm, or pnpm (tested with bun)

## Getting Started

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