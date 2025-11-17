# Community Resources

Discover community-built implementations, tools, and tutorials for working with the FAST Security Reference Implementation and UDAP.

!!! info "Community Contributions"
    This is a curated list of community resources. Have something to add? [Open an issue or PR](https://github.com/HL7-FAST/udap){:target="_blank"} on GitHub!

## :material-application: Reference Implementations

The FAST Identity Matching Implementation Guide includes reference implementations that demonstrate full UDAP integration:

<div class="grid cards" markdown>

-   :material-server:{ .lg .middle } **Identity Matching Server**

    ---

    Java HAPI FHIR server with UDAP support

    - Authorization code flow
    - Client credentials flow
    - Dynamic client registration

    [:fontawesome-brands-github: View Repository](https://github.com/HL7-FAST/identity-matching){:target="_blank"}

-   :material-application-outline:{ .lg .middle } **Identity Matching Client**

    ---

    Angular + Express web application

    - Confidential client pattern
    - Server-side token management
    - No browser token storage

    [:fontawesome-brands-github: View Repository](https://github.com/HL7-FAST/identity-matching-ui){:target="_blank"}

</div>

## :material-folder-open: Examples in This Repository

The FAST Security server includes example implementations in the `examples/` directory.

### :simple-docker: Docker FAST Identity Matching Stack

!!! example "Full Stack Example"
    Location: `examples/docker/compose-identity-matching.yml`

Complete Docker Compose setup that orchestrates:

- :material-shield-lock: FAST Security Server
- :material-server: Identity Matching FHIR Server
- :material-application: Identity Matching UI Client

**Start the stack:**

```bash title="Run full stack"
docker compose -f examples/docker/compose-identity-matching.yml up
```

### :material-react: Next.js Example Application

!!! example "Next.js Integration"
    Location: `examples/sandbox/`

A Next.js application demonstrating two client patterns:

=== "Authorization Code Flow"

    - Browser-based authentication
    - Access token in browser session
    - User context flows

=== "Client Credentials Flow"

    - Server-to-server authentication
    - Backend token management
    - Service account flows

**Run the example:**

```bash title="Start Next.js app"
cd examples/sandbox
bun install
bun dev
```

## :material-tools: Community Tools

### UdapEd - Interactive UDAP Tool

[:material-launch: Open UdapEd](https://udaped.fhirlabs.net){:target="_blank" .md-button }

A comprehensive web-based tool developed by Joe Shook for UDAP testing and education:

- Step-by-step client registration
- Step-by-step access token acquisition
- Many other UDAP utilities

## :material-school: Tutorials

### Complete UDAP Server Tutorial

[:fontawesome-brands-github: UDAP .NET Tutorial](https://github.com/JoeShook/udap-dotnet-tutorial){:target="_blank" .md-button .md-button--primary }

Comprehensive guide by Joe Shook covering:

- Setting up a FHIR server
- Implementing UDAP authentication
- Integrating with IdentityServer
- Trust anchor management
- Production deployment considerations

## :material-puzzle: Integration Examples

Looking for integration guides with specific platforms?

[:octicons-arrow-right-24: Check out our Integration Tutorials](integration/index.md)