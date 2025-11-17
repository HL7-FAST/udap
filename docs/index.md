# FAST Security Reference Implementation

Welcome to the documentation for the **FAST Security Reference Implementation** (RI). This project provides an open-source implementation of the [FAST Security Implementation Guide](https://build.fhir.org/ig/HL7/fhir-udap-security-ig) for UDAP-based authentication and authorization in FHIR ecosystems.

!!! info "Hosted Instance Available"
    A public hosted instance of the server is available in the HL7 Foundry at:
    
    :fontawesome-solid-globe: **<https://udap-security.fast.hl7.org>**

## :material-information-outline: Overview

This server is a .NET application that builds on top of the following:

- [**Duende IdentityServer**](https://duendesoftware.com/products/identityserver)
- [**UDAP.NET**](https://github.com/udap-tools/udap-dotnet)

## :octicons-mark-github-16: Source Code

The source code for this server is available on GitHub:

[:fontawesome-brands-github: View on GitHub](https://github.com/HL7-FAST/udap){ .md-button .md-button--primary }

## :material-rocket-launch: Quick Start

Ready to get started? Check out our comprehensive setup guide:

<div class="grid cards" markdown>

-   :material-clock-fast:{ .lg .middle } **Getting Started**

    ---

    Learn how to run the server locally or in a container

    [:octicons-arrow-right-24: Getting Started Guide](setup/getting-started.md)

-   :material-cog:{ .lg .middle } **Configuration**

    ---

    Configure database providers, URLs, and user credentials

    [:octicons-arrow-right-24: Configuration Guide](setup/configuration.md)

-   :material-database:{ .lg .middle } **Seeding Data**

    ---

    Initialize your database with trust anchors and communities

    [:octicons-arrow-right-24: Seeding Guide](setup/seeding-data.md)

-   :material-code-braces:{ .lg .middle } **Integration**

    ---

    Integrate with HAPI FHIR and other platforms

    [:octicons-arrow-right-24: Developer Guides](guides/)

</div>