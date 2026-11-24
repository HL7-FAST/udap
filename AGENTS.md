# AGENTS.md

This file provides guidance to agents when working with code in this repository.

# FAST Security Reference Implementation STU2

Reference implementation of the [HL7 FHIR UDAP Security Implementation Guide STU2](https://build.fhir.org/ig/HL7/fhir-udap-security-ig/index.html). Built on [Duende IdentityServer](https://duendesoftware.com/products/identityserver) and [UDAP .NET](https://github.com/udap-tools/udap-dotnet) libraries. A hosted instance is available at <https://udap-security.fast.hl7.org/>.

## Build & Run

```sh
# Build
dotnet build Udap.sln

# Run (defaults to https://localhost:5001)
dotnet run --project IdentityServer/IdentityServer.csproj

# Run with a specific environment
dotnet run --project IdentityServer/IdentityServer.csproj -- --environment=Local

# First-time HTTPS setup
dotnet dev-certs https
dotnet dev-certs https --trust

# Docker
docker-compose up
```

Unit tests live in IdentityServer.Tests (xUnit); run them with `dotnet test`. The database auto-migrates and seeds on startup when `AppConfig:SeedData` is `true` (the default). Verification is a build plus a smoke run: start the server and expect 200 from `/.well-known/udap`, `/.well-known/openid-configuration`, and `/Account/Login`. `/.well-known/udap` returns 404 when no issued certificate matches `AppConfig:UdapIdpBaseUrl`. A second instance on another port keeps the default `https://localhost:5001` identity and returns 200, unless `UdapIdpBaseUrl` is set to its own URL.

The Visual Studio and WSL2 launch profiles set `ASPNETCORE_ENVIRONMENT=Local`, so `appsettings.Local.json` is the file that usually wins during development.

### Verifying Postgres and SQL Server

SQLite is the default deployment. Postgres and SQL Server must keep working but are lightly exercised, so test them with throwaway containers after any Duende, Udap, or EF package change:

```sh
docker run -d --name udap-pg -e POSTGRES_PASSWORD=udap-test -e POSTGRES_DB=udap -p 15432:5432 postgres:latest
docker run -d --name udap-mssql -e ACCEPT_EULA=Y -e 'MSSQL_SA_PASSWORD=Udap-Test-Pa55word!' -p 11433:1433 mcr.microsoft.com/mssql/server:2022-latest

cd IdentityServer
AppConfig__DatabaseProvider=Pgsql ConnectionStrings__DefaultConnection="Host=localhost;Port=15432;Database=udap;Username=postgres;Password=udap-test" dotnet run --environment=Local
AppConfig__DatabaseProvider=SqlServer ConnectionStrings__DefaultConnection="Server=localhost,11433;Database=udap;User Id=sa;Password=Udap-Test-Pa55word!;TrustServerCertificate=True" dotnet run --environment=Local
```

A successful seed yields 14059 `ApiScopes`, 4 communities, and 4 anchors. On Postgres the tables are `udap.api_scopes`, `udap.udap_communities`, and `udap.udap_anchors`. Seed counts and the three endpoints do not exercise the client tables, so also run one dynamic client registration and one token request on each provider. Check each provider's snapshot separately, because the model differs per provider:

```sh
cd IdentityServer
dotnet ef migrations has-pending-model-changes -c UdapDbContext -p ../IdentityServer.Migrations.Pgsql -- AppConfig:DatabaseProvider=Pgsql
```

Udap.Server.Storage applies snake_case names inside a `udap` schema for Npgsql only, so a clean Sqlite check does not prove Postgres. On Pgsql the Duende contexts are `NpgsqlConfigurationDbContext` and `NpgsqlPersistedGrantDbContext`.

### Adding EF Core Migrations

Use the batch script or run manually:

```sh
# Batch script (Windows)
IdentityServer/add_migrations.bat {MigrationName}

# Manual (example: SQLite ConfigurationDb)
cd IdentityServer
dotnet ef migrations add {Name}ConfigurationDbMigration \
  -c ConfigurationDbContext \
  -p ../IdentityServer.Migrations.Sqlite \
  -o ../IdentityServer.Migrations.Sqlite/Migrations/ConfigurationDb \
  -- AppConfig:DatabaseProvider=Sqlite
```

Repeat for `PersistedGrantDbContext` and `UdapDbContext`, and for each database provider (Sqlite, SqlServer, Pgsql). On Pgsql the context names are `NpgsqlConfigurationDbContext` and `NpgsqlPersistedGrantDbContext`. Migration names follow the batch script: the name argument is a prefix such as `Update_Duende_v8_0`, and the Sqlite suffixes differ from the SqlServer/Pgsql suffixes. Regenerate the `create-*.sql` scripts in the same pass.

## Architecture

### Project Structure

```
Udap.sln
IdentityServer/                          Main web app (.NET 10)
  Program.cs                             Entry point, Serilog, OpenTelemetry, SeedData
  HostingExtensions.cs                   DI registration and middleware pipeline
  SeedData.cs                            DB migration, identity resources, FHIR scopes, trust anchors
  Models/AppConfig.cs                    Central configuration model
  Middleware/UdapMiddleware.cs            DCR scope validation on /connect/register
  Controllers/CertController.cs          Certificate generation API (POST /api/cert/generate)
  Shared/x509/CertificateTooling.cs      RSA and ECDSA certificate builders
  Pages/Admin/                           Client, API scope, identity scope management
  Pages/Udap/                            Anchor and community management
  Pages/Account/                         Login, logout, external auth
  Sandbox/SandboxHostService.cs          Runs the embedded Next.js sandbox as a child process
  CertStore/                             Trust anchor certs organized by community
    {CommunityName}/                     Anchor .cer/.crt files
      intermediates/                     Intermediate CA certs
      crl/                               CRL files
    issued/                              Server identity certs (.pfx)
IdentityServer.Migrations.Sqlite/       SQLite migrations
IdentityServer.Migrations.SqlServer/    SQL Server migrations
IdentityServer.Migrations.Pgsql/        PostgreSQL migrations
certs/                                   Development CA and client certificates
docs/                                    MkDocs documentation site
```

### Middleware Pipeline (HostingExtensions.ConfigurePipeline)

1. PathBase (if configured)
2. ForwardedHeaders (X-Forwarded-For/Proto/Host)
3. Serilog request logging
4. HTTPS redirection (skipped for `/certs` path)
5. Static files + `/certs` directory browsing from CertStore
6. CORS (allow all)
7. `UseUdapMetadataServer()` -- signed UDAP metadata at `/.well-known/udap`
8. `UseIdentityServer()` -- Duende IdentityServer
9. `UseUdapServer()` -- UDAP DCR endpoints
10. `UseCustomUdapMiddleware()` -- scope validation on `/connect/register`
11. Authorization + Razor Pages routing

### Database

Three EF Core DbContexts (all from NuGet packages):

| Context | Purpose |
|---------|---------|
| `ConfigurationDbContext` | IdentityServer clients, scopes, resources |
| `PersistedGrantDbContext` | Tokens, grants, consents |
| `UdapDbContext` | Communities, anchors, intermediates, UDAP clients |

Provider is selected at startup via `AppConfig:DatabaseProvider` (`Sqlite`, `SqlServer`, or `Pgsql`). Each has a dedicated migrations assembly. Default connection string: `Data Source=IdentityServer.db;`.

On `Pgsql` the two Duende contexts are `NpgsqlConfigurationDbContext` and `NpgsqlPersistedGrantDbContext` from Udap.Server.Storage. They create the Duende tables as snake_case names in the `udap` schema, which is where `UdapDbContext` reads the client tables on Npgsql. Application code resolves `IConfigurationDbContext` and `IPersistedGrantDbContext`, never the concrete types.

### Trust Model

UDAP uses X.509 certificate chains organized into **trust communities**:

- **Community**: A named trust domain (e.g., `udap://LocalProvider`)
- **Anchor**: A root/trust anchor certificate for a community
- **Intermediate**: Optional intermediate CA certificates in the chain

SeedData populates communities from two sources:
1. **CertStore directory** -- each subdirectory becomes a community; `.cer`/`.crt` files are anchors
2. **AppConfig:Anchors array** -- file paths or base64-encoded certificates with community names

### Conventions

- Duende 8 requires a `CancellationToken` on every interaction and store call. Pass `HttpContext.RequestAborted` from PageModels and `context.RequestAborted` from middleware.
- Denials use `InteractionError.AccessDenied` (`AuthorizationError` no longer exists).
- Line endings are mixed: most files are LF but some (for example `Pages/Account/Login/Index.cshtml.cs`) are CRLF. Check with `git ls-files --eol` before scripted edits.
- `/.well-known/udap` is signed UDAP metadata from Udap.Metadata.Server (FAST Security IG section 2). `UdapMetadataOptionsProvider` builds its options per request. The server identity is `AppConfig:UdapIdpBaseUrl`, never the `Host` header, because the document is signed. Endpoints and scopes come from Duende's discovery document for that URL, and a community is published only when `UdapFileCertStoreManifest` holds a certificate whose SAN URI equals it. With no such certificate the URL returns 404. `iss` is the SAN text, and both committed server certificates have a SAN that ends with a slash. The library middleware matches any path that ends with `/.well-known/udap`, so `UseWhen` limits it to this server's own path. OpenID fields such as `userinfo_endpoint` are only in `/.well-known/openid-configuration`.
- `dotnet run --environment=X` without `--` is an option of `dotnet run` itself, and the launch profile then sets `Local`. For another environment use `ASPNETCORE_ENVIRONMENT=X dotnet run --no-launch-profile`.
- Udap 0.9.21 refuses `http` redirect URIs (the IG requires `https`). `ServerSettings:AllowLoopbackHttpRedirectUris` allows `http` on loopback addresses only. It is set to `true` in the git-ignored `appsettings.Local.json` for the standalone sandbox, and it stays off in every tracked settings file.
- `ServerSettings.TieredIdp` stays off. It rejects UDAP authorization requests that lack the `udap` or `openid` scope, which ordinary UDAP clients do not send.
- The committed LocalSubCA certificate names its CRL at `http://localhost:5000`. A test instance on other ports needs something that serves port 5000, or every registration fails with `CrlFetchFailed` in the log.
- `ScenarioVerificationTests` (Category=Live) prints each scenario result and asserts nothing. Read its output.
- `docs/features/resource-sign-in.md` describes the FHIR resource sign-in. `FhirPersona` holds its shared rules. `FhirPersonaProfileService`, `FhirPersonaClaimsService`, `FhirContextTokenResponseGenerator`, `FhirPersonaInteractionResponseGenerator`, and the login page apply them. The login page also applies the local login condition.
- `HostingExtensions` registers those four services after `AddUdapServer`, `AddIdentityServer`, and `AddTestUsers`, because the last registration of a service wins.
- A second `ICustomTokenRequestValidator` replaces the `UdapCustomTokenRequestValidator` that `AddUdapServer` registers. Do not register one.
- The session claim `fhir_base` goes in no token, also when a scope asks for a claim of that name.
- `FhirPersonaInteractionResponseGenerator` can add `prompt=login` before the base call, so Duende marks the request, and the marked request skips the rule for a different resource.
- A request with the `udap` scope is a tiered flow. For such a request, `hl7fast_signin` and a resource `login_hint` have no effect on the resource sign-in. The rules for a different server, a different resource, and a missing patient are off, and a resource session gets a sign-in again (`NewSignInReason.TieredRequest`).

### Key Customizations

**UdapMiddleware** -- Intercepts `/connect/register` POST requests, parses the UDAP software statement JWT, extracts requested scopes, validates them against configured API scopes and identity resources, and expands FHIR wildcards (e.g., `system/*.read` into per-resource scopes). Returns 400 if no valid scopes remain.

**SeedData** -- Seeds identity resources (openid, profile, email, fhirUser, udap), SMART v1/v2 FHIR scopes for patient/user/system access, and trust communities with anchors.

### Authorization Policies

- `system-admin` -- requires `sub == "1"` (admin user), applied to `/Admin/*`
- `udap-admin` -- requires `sub == "1"` or `sub == "2"`, applied to `/Udap/*`

### Test Users (seeded)

| Username | SubjectId | Password Config Key |
|----------|-----------|---------------------|
| admin | 1 | AppConfig:SystemAdminPassword (default: "admin") |
| udap | 2 | AppConfig:UdapAdminPassword (default: "udap") |
| user | 3 | AppConfig:UserPassword (default: "user") |

## Configuration

All settings live under `AppConfig` in appsettings.json. Override per-environment in `appsettings.{Environment}.json` or `appsettings.Local.json`.

### AppConfig Properties

| Property | Default | Purpose |
|----------|---------|---------|
| `DatabaseProvider` | `Sqlite` | `Sqlite`, `SqlServer`, or `Pgsql` |
| `SeedData` | `true` | Auto-migrate and seed on startup |
| `UdapIdpBaseUrl` | `https://localhost:5001` | Public base URL of this server. Sets the identity, the endpoints, and the signing certificate of the UDAP metadata |
| `PathBase` | `""` | For reverse-proxy path-based hosting |
| `IssuerUri` | `""` | Override IdentityServer issuer URI |
| `RootCertFile` | `../certs/LocalCA.pfx` | Root CA for local cert generation |
| `IntermediateCertFile` | `../certs/LocalSubCA.pfx` | Intermediate CA for cert generation |
| `DefaultCertPassword` | `udap-test` | Default password for cert files |
| `IntermediateCrlUrl` | (localhost) | CRL distribution point URL. Its `/certs/<community>/crl/` path also picks the CertStore folder the CRLs are written to |
| `IntermediateCertUrl` | (localhost) | AIA intermediate cert URL |
| `Anchors` | `[]` | Additional trust anchors (AnchorFile + Community) |
| `SandboxEnabled` | `false` (`true` in the Docker image) | Run the Next.js sandbox as a child process and forward `/sandbox/*` to it (see docs/features/sandbox.md) |
| `SandboxFhirServerUrl` | public FHIR server | FHIR server whose UDAP metadata names the authorization server the sandbox registers with (compose: host.docker.internal:8080) |
| `SandboxAuthSecret` | random per start | Auth.js session secret for the sandbox |
| `SandboxCertFile` | (minted at start) | Client certificate for the sandbox default clients, path or base64 PKCS#12 |

### Other Configuration Sections

- **ServerSettings** -- UDAP server behavior: `DefaultSystemScopes`, `DefaultUserScopes`, `ForceStateParamOnAuthorizationCode`
- **UdapClientOptions** -- Client metadata: `ClientName`, `Contacts`, `TieredOAuthClientLogo`
- **UdapFileCertStoreManifest** -- Server identity certificates per community (PFX files with private keys)
- **ConnectionStrings:DefaultConnection** -- Database connection string

### Development Certificates

The `certs/` directory contains development PKI:
- `LocalCA.pfx` -- Root CA (password: udap-test)
- `LocalSubCA.pfx` -- Intermediate CA (password: udap-test)
- `localhost.pfx` -- HTTPS server cert (password: udap-test)
- `local-client-cert.pfx` -- Client cert for testing

In Development/Local environments, the `CertificateDownloadCache` HttpClient is configured to accept untrusted server certificates for CRL/cert downloads from localhost.

## Key Dependencies

- **Duende.IdentityServer** 8.0.10 -- OAuth 2.0 / OpenID Connect server
- **Udap.Server** 0.9.21 -- UDAP protocol implementation
- **Udap.Metadata.Server** 0.9.21 -- signed UDAP metadata at `/.well-known/udap`
- **Udap.UI** 0.9.21 -- UI components for UDAP flows
- **Entity Framework Core** 10.0.x -- ORM with multi-provider support
- **Serilog** -- Structured logging
- **OpenTelemetry** -- Distributed tracing and metrics (enabled via `OTEL_EXPORTER_OTLP_ENDPOINT` env var)
  `OTEL_*_FILE` variables name files that hold the real values, for example Docker secrets under `/run/secrets`.

## Endpoints

| Path | Purpose |
|------|---------|
| `/` | Home / landing page |
| `/.well-known/udap` | UDAP metadata discovery |
| `/connect/register` | UDAP Dynamic Client Registration |
| `/connect/authorize` | OAuth authorization endpoint |
| `/connect/token` | OAuth token endpoint |
| `/certs` | Certificate store with directory browsing (HTTP allowed) |
| `/api/cert/generate` | Certificate generation API |
| `/swagger` | Swagger/OpenAPI documentation |
| `/docs` | MkDocs documentation site (Docker only) |
| `/sandbox` | Embedded Next.js sandbox, forwarded to a Node child process (Docker only, `AppConfig:SandboxEnabled`) |
| `/health` | Health check (Docker only) |
