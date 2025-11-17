# Configuration

The server uses standard .NET configuration patterns with support for multiple configuration sources.

!!! info "Configuration Files"
    Configuration can be set in:
    
    - `appsettings.json` - Base configuration
    - `appsettings.Development.json` - Development overrides
    - `appsettings.Local.json` - Local overrides (not tracked in git)
    - Environment variables - Runtime configuration
    - `docker-compose.yml` - Container configuration

## :material-cog: AppConfig Settings

The following settings are available in the `AppConfig` section:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `DatabaseProvider` | `Sqlite` \| `SqlServer` | `Sqlite` | :fontawesome-solid-database: Database provider for persistence. Must match the connection string in `ConnectionStrings.DefaultConnection`. |
| `UdapIdpBaseUrl` | string | `https://localhost:5001` | :material-link: Base URL for the server (e.g., `https://localhost:5001`). Used for the `registration_endpoint` in `.well-known/udap`. |
| `SeedData` | `true` \| `false` | `false` | :material-database-import: Whether to seed initial data on startup. See [Seeding Data](seeding-data.md). |
| `SystemAdminPassword` | string | `admin` | :material-shield-account: Password for the default system administrator user. |
| `UdapAdminPassword` | string | `udap` | :material-shield-key: Password for the default UDAP administrator user. |
| `UserPassword` | string | `user` | :material-account: Password for the default test user (no admin privileges). |

