# Server Setup

Get the FAST Security Reference Implementation up and running in your environment.

## :material-list-box-outline: Setup Steps

Follow these guides in order to set up and configure your server:

<div class="grid" markdown>

=== "1. Getting Started"

    :material-rocket-launch: Install requirements and start the server

    Choose between:
    
    - Local development with .NET
    - Container deployment with Docker

    [:octicons-arrow-right-24: Getting Started Guide](getting-started.md){ .md-button .md-button--primary }

=== "2. Configuration"

    :material-cog: Configure database, URLs, and authentication

    Set up:
    
    - Database providers
    - Base URLs and endpoints  
    - User credentials
    - Environment-specific settings

    [:octicons-arrow-right-24: Configuration Guide](configuration.md){ .md-button .md-button--primary }

=== "3. Seeding Data"

    :material-database-import: Initialize with trust anchors and communities

    Learn about:
    
    - File-based anchor loading
    - Configuration-based seeding
    - Community creation
    - Default users

    [:octicons-arrow-right-24: Seeding Guide](seeding-data.md){ .md-button .md-button--primary }

</div>

## :material-check-circle: Quick Verification

After setup, verify your installation:

```bash title="Check UDAP Discovery endpoint"
curl https://localhost:5001/.well-known/udap
```

You should receive a signed JWT containing the server's UDAP metadata.

## :material-help-circle: Need Help?

If you encounter issues:

- Check the [GitHub Issues](https://github.com/HL7-FAST/udap/issues)
- Review the [.NET troubleshooting guide](https://learn.microsoft.com/en-us/dotnet/core/tools/)
- Join the [community discussions](https://github.com/HL7-FAST/udap/discussions)
