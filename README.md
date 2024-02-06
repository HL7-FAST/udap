# UDAP Security Reference Implementation

This project is a reference implementation for the [UDAP Security Implementation Guide](http://build.fhir.org/ig/HL7/fhir-udap-security-ig/).  It is built using the [Duende IdentityServer](https://duendesoftware.com/products/identityserver) and [UDAP .NET](https://github.com/udap-tools/udap-dotnet) libraries.

## Requirements
- .NET 8
- (optional) Microsoft SQL Server

## Running the Server

The project can be run from the command line using the `dotnet run` command in the `IdentityServer` directory.  The server will be available at `https://localhost:5001`.

If this is the first time running the server, you will likely need to create a self-signed certificate.  This can be done by running the following command:

```
dotnet dev-certs https
```
Additionally, you can trust the certificate by running the following command on Windows or MacOS:
```
dotnet dev-certs https --trust
```

## Configuration
The server can be configured using the `appsettings.json` file (or the `appsettings.Development.json` or `appsettings.Local.json` files). Examples of setting these values can be found in the existing `appsettings.json` files as well as the `docker-compose.yml` and `docker-compose.override.yml` files.

The following table describes the configuration options available to set in the `AppConfig` section of the `appsettings.json` file (or through environment variables).

| Setting | Value(s) | Default | Description |
| ------- | -------- | ------- | ----------- |
| `DatabaseProvider` | `Sqlite`, `SqlServer`  | `Sqlite` | The database provider to use for data persistence.  This should correspond to the connection string set in the `ConnectionStrings.DefaultConnection` property. |
| `UdapIdpBaseUrl` | Server base URL | | The base URL for the server (eg: `https://localhost:5001`) used for forming the `registration_endpoint` in the `.well-known/udap` statement. |
| `SeedData` | `true`, `false` | `false` | Sets whether to seed the database with initial data. See the [Seeding Data](#seeding-data) section for more information. |
| `SystemAdminPassword` | string | `admin`  | The password for the default system admin user. |
| `UdapAdminPassword` | string | `udap` | The password for the default UDAP admin user. |
| `UserPassword` | string | `user` | The password for the default user that has no admin privileges, but can be used for testing access token generation in clients. |


## Seeding Data

When the `SeedData` configuration option is set to `true`, the server will seed the database with initial data.  This includes running the database migrations found in the included migration projects (such as `IdentityServer.Migrations.Sqlite`).

Additionally, the server will add any trust anchor certificates found in the `CertStore` directory to the initial database.  It will create a community for each directory found in the `CertStore` directory where the community name will match the directory name.  It will add a trust anchor to the community using any `.crt` file found in the directory.

