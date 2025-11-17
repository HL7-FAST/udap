# Seeding Data

Data seeding allows you to initialize the database with trust anchors, communities, and other essential data when the server starts.  This is enabled by default in the provided local configuration.

!!! tip "Enable Seeding"
    Set `AppConfig__SeedData` to `true` to enable automatic data seeding on server startup.

## :material-database-sync: What Gets Seeded

When seeding is enabled, the server performs the following operations:

1. :material-database-cog: **Runs database migrations** from the migration projects (e.g., `IdentityServer.Migrations.Sqlite`)
2. :material-certificate: **Loads trust anchor certificates** from the file system and configuration
3. :material-account-group: **Creates trust communities** based on directory structure
4. :material-account-key: **Initializes default users** with configured passwords

## :material-folder-open: File-based Seeding

The server automatically discovers trust anchors from the `CertStore` directory:

!!! info "Directory Structure"
    - Each subdirectory in `CertStore` becomes a **trust community**
    - The directory name becomes the **community name**
    - All `.cer` and `.crt` files in the directory are added as **trust anchors**

**Default structure:**

```
CertStore/
├── EmrDirect/
│   └── EmrDirectTestCA.crt
├── LocalCA/
│   ├── LocalCA.crt
│   └── intermediates/
│       └── LocalSubCA.crt
├── FastCA/
│   ├── FastCA.crt
│   └── intermediates/
│       └── FastSubCA.crt
└── SureFhirLabs/
    └── SureFhirLabs.crt
```

## :material-code-json: Configuration-based Seeding

You can also seed anchors through configuration using the `AppConfig__Anchors` setting:

```json title="appsettings.json"
{
  "AppConfig": {
    "SeedData": true,
    "Anchors": [
      {
        "AnchorFile": "/path/to/anchor.crt",
        "Community": "MyTrustCommunity1"
      },
      {
        "AnchorFile": "base64 encoded string of anchorfile",
        "Community": "MyTrustCommunity2"
      }
    ]
  }
}
```

!!! note "Anchor File Formats"
    The `AnchorFile` property accepts:
    
    - **File path** - Absolute or relative path to a `.cer` or `.crt` file
    - **Base64 string** - Base64-encoded certificate content

