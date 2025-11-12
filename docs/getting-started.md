# Getting Started

Run the server with `dotnet run` specifying the project file:

```sh
dotnet run --project IdentityServer/IdentityServer.csproj
```

If this is the first time running the server, you will likely need to create a self-signed certificate.  This can be done by running the following command:

```sh
dotnet dev-certs https
```
Additionally, you can trust the certificate by running the following command:
```sh
dotnet dev-certs https --trust
```

More information on self-signed certificates and development certificates can be found in the [.NET documentation](https://learn.microsoft.com/en-us/dotnet/core/additional-tools/self-signed-certificates-guide).
