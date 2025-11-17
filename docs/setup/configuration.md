# Configuration

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
