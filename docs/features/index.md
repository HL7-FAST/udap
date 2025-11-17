# Server Features

Explore the key features and capabilities of the FAST Security Reference Implementation.

## :material-certificate-outline: Certificate Management

The server provides robust certificate management capabilities:

<div class="grid cards" markdown>

-   :material-certificate:{ .lg .middle } **Dynamic Certificate Generation**

    ---

    Generate client certificates on-demand using configured Certificate Authorities

    [:octicons-arrow-right-24: Learn More](certificate-generation.md)

-   :material-shield-lock:{ .lg .middle } **Trust Anchor Management**

    ---

    Manage trust communities and anchor certificates through seeding and APIs

    [:octicons-arrow-right-24: Seeding Guide](../setup/seeding-data.md)

</div>

## :material-api: UDAP Endpoints

Full implementation of UDAP Discovery and registration endpoints:

- :material-information: **`.well-known/udap`** - UDAP Discovery metadata
- :material-account-plus: **`/connect/register`** - Dynamic client registration
- :material-key: **`/connect/token`** - Token endpoint
- :material-lock: **`/connect/authorize`** - Authorization endpoint
- :material-account-circle: **`/connect/userinfo`** - UserInfo endpoint

## :material-database: Database Support

Flexible database provider support:

- :material-database: **SQLite** - Default, zero-configuration option
- :material-microsoft: **SQL Server** - Production-ready option
- :simple-postgresql: **PostgreSQL** - Via migration projects

## :material-account-group: Identity Management

Built on Duende IdentityServer with:

- Multiple authentication flows
- User management
- Consent screens
- Session management
