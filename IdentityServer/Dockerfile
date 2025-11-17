#See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build-server
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["IdentityServer/IdentityServer.csproj", "IdentityServer/"]
RUN dotnet restore "./IdentityServer/./IdentityServer.csproj"
COPY . .
WORKDIR "/src/IdentityServer"
RUN dotnet build "./IdentityServer.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build-server AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./IdentityServer.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM python:3.11-alpine AS build-docs
WORKDIR /src
COPY mkdocs.yml .
COPY docs/ ./docs/
RUN pip install --no-cache-dir mkdocs mkdocs-material pymdown-extensions
RUN mkdocs build -d /app/docs

FROM base AS final

# Install ca-certificates for certificate management
RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --from=publish /app/publish .
COPY --from=build-docs /app/docs ./wwwroot/docs

# local default certificate for HTTPS support
COPY ../certs/localhost.pfx .
ENV ASPNETCORE_Kestrel__Certificates__Default__Password="udap-test"
ENV ASPNETCORE_Kestrel__Certificates__Default__Path="/app/localhost.pfx"

# default local root and intermediate CA certs for cert generation endpoint
COPY ../certs/LocalCA.pfx .
COPY ../certs/LocalSubCA.pfx .
ENV AppConfig__RootCertFile="/app/LocalCA.pfx"
ENV AppConfig__IntermediateCertFile="/app/LocalSubCA.pfx"
ENV AppConfig__RootCertPassword="udap-test"
ENV AppConfig__IntermediateCertPassword="udap-test"

# Install self-signed local certificates into system trust store
COPY IdentityServer/CertStore/LocalCA/LocalCA.crt /usr/local/share/ca-certificates/LocalCA.crt
COPY IdentityServer/CertStore/LocalCA/intermediates/LocalSubCA.crt /usr/local/share/ca-certificates/LocalSubCA.crt
COPY IdentityServer/CertStore/FastCA/FastCA.crt /usr/local/share/ca-certificates/FastCA.crt
COPY IdentityServer/CertStore/FastCA/intermediates/FastSubCA.crt /usr/local/share/ca-certificates/FastSubCA.crt
RUN update-ca-certificates



# Container health check defaults to checking https://localhost:443/health unless HEALTHCHECK_URL is set
HEALTHCHECK --interval=10s --timeout=10s --start-period=60s \
  CMD wget --no-check-certificate --quiet --spider -S "${HEALTHCHECK_URL:-https://localhost:443/health}" || exit 1

ENTRYPOINT ["dotnet", "IdentityServer.dll"]