# Getting Started

!!! tip "Hosted Instance"
    A hosted instance of this server is available at <https://udap-security.fast.hl7.org>. 
    
    This guide is for running the server **locally** for development or testing purposes.

## :material-package-variant: Requirements

=== "Local Development"

    To run the server locally, you will need:

    - :simple-dotnet: [**.NET 9 SDK**](https://dotnet.microsoft.com/) - Required
    - :fontawesome-solid-database: **Microsoft SQL Server** - Optional (SQLite is used by default)
    - :simple-python: **Python 3.x** - Optional (for building documentation)

=== "Container Runtime"

    To run the server in a container, you will need a container manager such as:

    - :simple-docker: [**Docker**](https://www.docker.com/)
    - :simple-podman: [**Podman**](https://podman.io/)


## :material-play-circle: Starting the Server Locally

Run the server from the root directory of the project:

```bash title="Start the server"
dotnet run --project IdentityServer/IdentityServer.csproj
```

!!! success "Server Started"
    The server will start on **<https://localhost:5001>** by default.

### :material-certificate: Development Certificates

!!! warning "First Time Setup"
    If this is your first time running the server, you'll likely need to create and trust a development certificate.

**Create the certificate:**

```bash title="Generate dev certificate"
dotnet dev-certs https
```

**Trust the certificate:**

```bash title="Trust the certificate"
dotnet dev-certs https --trust
```

!!! info "Learn More"
    For more information on development certificates, see the [.NET documentation](https://learn.microsoft.com/en-us/dotnet/core/additional-tools/self-signed-certificates-guide).


## :simple-docker: Running in a Container

You can also run the server in a container.

!!! note "Container Manager Compatibility"
    These instructions use Docker, but should work with other OCI-compatible container managers like Podman.

=== "Docker Compose"

    The easiest way to run the server is using Docker Compose:

    ```bash title="Start with Docker Compose"
    docker compose up
    ```

    This will use the pre-built image from Docker Hub and start the server with all necessary configuration.

=== "Pre-built Image"

    Pull and run the pre-built image directly:

    ```bash title="Run pre-built container"
    docker run -p 5001:443 -e ASPNETCORE_URLS="https://+:443" hlseven/fast-udap-security
    ```

    The server will be available at `https://localhost:5001`.

=== "Build Locally"

    Build the Docker image from source:

    ```bash title="Build Docker image"
    docker build -f IdentityServer/Dockerfile -t fast-security .
    ```

    Then run your locally-built image:

    ```bash title="Run local container"
    docker run -p 5001:443 fast-security
    ```


