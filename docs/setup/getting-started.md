# Getting Started

A hosted instance of this server is available at <https://udap-security.fast.hl7.org>. This guide is for running the server locally.

## Requirements

To run the server locally, you will need to have the following installed:

- [.NET 9](https://dotnet.microsoft.com/)
- (optional) Microsoft SQL Server
- (optional) Python for building documentation from the `docs` directory

To run the server in a container, you will need a locally installed container manager such as:

- [Docker](https://www.docker.com/)
- [Podman](https://podman.io/)


## Starting the Server Locally

Run the server in the root directory of the project with `dotnet run` specifying the project file:

```sh
dotnet run --project IdentityServer/IdentityServer.csproj
```

This will start the server on <https://localhost:5001> by default.

If this is the first time running the server, you will likely need to create a self-signed certificate.  This can be done by running the following command:

```sh
dotnet dev-certs https
```
Additionally, you can trust the certificate by running the following command:
```sh
dotnet dev-certs https --trust
```

More information on self-signed certificates and development certificates can be found in the [.NET documentation](https://learn.microsoft.com/en-us/dotnet/core/additional-tools/self-signed-certificates-guide).


## Running in a Container

You can also run the server in a container.  These instructions use [Docker](https://www.docker.com/), but they should also generally work with other container managers such as [Podman](https://podman.io/).

### Using Pre-built Image

A pre-built Docker image is available on Docker Hub. You can use Docker Compose or run the container directly. To use Docker Compose run the following from the root directory of the project:

```sh
docker compose up
```

To run the container directly, you can pull the image from Docker Hub and run it with the following command:

```sh
docker run -p 5001:443 -e ASPNETCORE_URLS="https://+:443" hlseven/fast-udap-security
```

### Building the Docker Image Locally


Or, you can build the Docker image locally by navigating to the root directory of the project and running:

```sh
docker build -f IdentityServer/Dockerfile -t fast-security .
```

Once the image is built, you can run the container with:

```sh
docker run -p 5001:443 fast-security
```


