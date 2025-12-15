# FAST Security Reference Implementation

This project is a reference implementation for the [FAST Security Implementation Guide STU2](http://build.fhir.org/ig/HL7/fhir-udap-security-ig/).  It is built using the [Duende IdentityServer](https://duendesoftware.com/products/identityserver) and [UDAP .NET](https://github.com/udap-tools/udap-dotnet) libraries.

## Hosted Instance

A hosted instance of this server is available in the HL7 Foundry at: <https://udap-security.fast.hl7.org/>

## Documentation

Full documentation can be found in the [docs](./docs) directory.  A hosted version of this documentation is also available at: <https://udap-security.fast.hl7.org/docs>


## Requirements

- .NET 9
- (optional) Microsoft SQL Server
- (optional) Docker
- (optional) Python for building documentation from the `docs` directory

## Quick Start

Run the server with `dotnet run` specifying the project file:

```sh
dotnet run --project IdentityServer/IdentityServer.csproj
```

If this is the first time running the server, you will likely need to create a self-signed certificate.  This can be done by running the following command:

```sh
dotnet dev-certs https
```

Additionally, you can trust the certificate by running the following command:

```sh
dotnet dev-certs https --trust
```

More information on self-signed certificates and development certificates can be found in the [.NET documentation](https://learn.microsoft.com/en-us/dotnet/core/additional-tools/self-signed-certificates-guide).
