#See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-server
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

FROM node:22-alpine AS build-sandbox
WORKDIR /src
RUN npm install -g bun
COPY examples/sandbox/package.json examples/sandbox/bun.lock examples/sandbox/bunfig.toml ./
RUN bun install --frozen-lockfile
COPY examples/sandbox/ .
# Must equal AppConfig:PathBase + /sandbox at runtime; Next.js inlines it into every asset URL and link.
ARG SANDBOX_BASE_PATH=/sandbox
ENV NEXT_PUBLIC_BASE_PATH=$SANDBOX_BASE_PATH
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build \
    && cp -r public .next/standalone/ \
    && cp -r .next/static .next/standalone/.next/

FROM base AS final

# ca-certificates for certificate management, nodejs for the embedded sandbox
RUN apk add --no-cache ca-certificates nodejs

WORKDIR /app
COPY --from=publish /app/publish .
COPY --from=build-docs /app/docs ./wwwroot/docs
COPY --from=build-sandbox /src/.next/standalone ./sandbox

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

# The image serves the sandbox by default; dotnet run outside Docker does not
ENV AppConfig__SandboxEnabled=true

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