using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
using IdentityServer.Models;
using IdentityServer.Shared.x509;
using Microsoft.Extensions.Options;

namespace IdentityServer.Sandbox;

/// <summary>
/// Runs the standalone Next.js sandbox as a child process on a loopback port and
/// restarts it when it exits. The /sandbox forwarder in the pipeline targets that port.
/// </summary>
public sealed class SandboxHostService(
    IOptions<AppConfig> appConfig,
    IServiceScopeFactory scopeFactory,
    IWebHostEnvironment hostEnvironment,
    ILogger<SandboxHostService> logger) : BackgroundService
{
    public const string RoutePrefix = "/sandbox";
    public const string DestinationPrefix = "http://127.0.0.1:3000";

    private readonly AppConfig _config = appConfig.Value;

    /// <summary>The sandbox's public URL, derived from the server's own base URL.</summary>
    public static string AppUrl(AppConfig config) => config.UdapIdpBaseUrl.TrimEnd('/') + RoutePrefix;

    /// <summary>The path the Next.js build must be compiled for, because Next inlines it into every asset URL and link.</summary>
    public static string ExpectedBasePath(AppConfig config) => (config.PathBase ?? "").TrimEnd('/') + RoutePrefix;

    /// <summary>Reads the basePath recorded by next build so a mismatch with the server's path base is reported instead of surfacing as 404s.</summary>
    public static string? BuiltBasePath(string sandboxDirectory)
    {
        var manifest = Path.Combine(sandboxDirectory, ".next", "required-server-files.json");
        if (!File.Exists(manifest))
        {
            return null;
        }
        using var json = JsonDocument.Parse(File.ReadAllBytes(manifest));
        return json.RootElement.TryGetProperty("config", out var config) && config.TryGetProperty("basePath", out var basePath)
            ? basePath.GetString()
            : null;
    }

    /// <summary>The two SANs let the sandbox register its authorization_code and client_credentials clients from one certificate.</summary>
    public static string[] ClientAltNames(string appUrl) => [appUrl + "/#SAN1", appUrl + "/#SAN2"];

    /// <summary>
    /// Everything the Node process needs. Only the FHIR server, secret and certificate are not derived from the base URL.
    /// <paramref name="trustAnyServerCertificate"/> mirrors the server's own Development and Local policy for outbound calls,
    /// because the development HTTPS certificate does not chain to a CA in the image.
    /// </summary>
    public static Dictionary<string, string> BuildEnvironment(AppConfig config, string certFile, string certPassword, string authSecret, bool trustAnyServerCertificate)
    {
        var destination = new Uri(DestinationPrefix);
        var appUrl = AppUrl(config);
        var environment = new Dictionary<string, string>
        {
            ["NODE_ENV"] = "production",
            ["HOSTNAME"] = destination.Host,
            ["PORT"] = destination.Port.ToString(),
            ["APP_URL"] = appUrl,
            ["AUTH_URL"] = appUrl + "/api/auth",
            ["AUTH_TRUST_HOST"] = "true",
            ["AUTH_SECRET"] = authSecret,
            ["CERT_FILE"] = certFile,
            ["CERT_PASSWORD"] = certPassword,
            // The system bundle holds the local CAs the Dockerfile installs as well as the public roots.
            ["NODE_EXTRA_CA_CERTS"] = "/etc/ssl/certs/ca-certificates.crt",
        };
        if (!string.IsNullOrEmpty(config.SandboxFhirServerUrl))
        {
            environment["FHIR_SERVER_URL"] = config.SandboxFhirServerUrl;
        }
        if (trustAnyServerCertificate)
        {
            environment["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
        }
        return environment;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var serverJs = Path.Combine(hostEnvironment.ContentRootPath, "sandbox", "server.js");
        if (!File.Exists(serverJs))
        {
            logger.LogError("AppConfig:SandboxEnabled is true but {ServerJs} does not exist; the sandbox will not start", serverJs);
            return;
        }

        var builtBasePath = BuiltBasePath(Path.GetDirectoryName(serverJs)!);
        if (builtBasePath != ExpectedBasePath(_config))
        {
            logger.LogError("The sandbox was built for base path {BuiltBasePath} but AppConfig:PathBase requires {ExpectedBasePath}; rebuild the image with --build-arg SANDBOX_BASE_PATH={ExpectedBasePath}",
                builtBasePath, ExpectedBasePath(_config), ExpectedBasePath(_config));
        }

        var certFile = _config.SandboxCertFile;
        var certPassword = _config.SandboxCertPassword ?? _config.DefaultCertPassword;
        if (string.IsNullOrEmpty(certFile))
        {
            certPassword = _config.DefaultCertPassword;
            certFile = Convert.ToBase64String(await MintClientCertificateAsync(certPassword, stoppingToken));
        }
        var authSecret = _config.SandboxAuthSecret ?? Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var trustAnyServerCertificate = hostEnvironment.IsDevelopment() || hostEnvironment.IsEnvironment("Local");
        if (trustAnyServerCertificate)
        {
            logger.LogWarning("Sandbox runs with server certificate verification disabled because the environment is {Environment}", hostEnvironment.EnvironmentName);
        }
        var environment = BuildEnvironment(_config, certFile, certPassword, authSecret, trustAnyServerCertificate);

        while (!stoppingToken.IsCancellationRequested)
        {
            using var process = Start(serverJs, environment);
            try
            {
                await process.WaitForExitAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                process.Kill(entireProcessTree: true);
                return;
            }
            logger.LogWarning("Sandbox exited with code {ExitCode}; restarting", process.ExitCode);
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    private async Task<byte[]> MintClientCertificateAsync(string password, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var generator = scope.ServiceProvider.GetRequiredService<CertGenerator>();
        var valid = CertScenarioCatalog.Find(CertScenarioCatalog.Valid)
            ?? throw new InvalidOperationException("The valid certificate scenario is missing from the catalog");
        return await generator.GenerateAsync(ClientAltNames(AppUrl(_config)), password, valid, CertKeyType.Rsa, ct);
    }

    private Process Start(string serverJs, Dictionary<string, string> environment)
    {
        var startInfo = new ProcessStartInfo("node")
        {
            WorkingDirectory = Path.GetDirectoryName(serverJs),
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        startInfo.ArgumentList.Add(serverJs);
        foreach (var (key, value) in environment)
        {
            startInfo.Environment[key] = value;
        }

        var process = new Process { StartInfo = startInfo };
        process.OutputDataReceived += (_, e) => Log(LogLevel.Information, e.Data);
        process.ErrorDataReceived += (_, e) => Log(LogLevel.Warning, e.Data);
        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        logger.LogInformation("Sandbox started (pid {Pid}) serving {AppUrl} from {Destination}", process.Id, environment["APP_URL"], DestinationPrefix);
        return process;
    }

    private void Log(LogLevel level, string? line)
    {
        if (!string.IsNullOrWhiteSpace(line))
        {
            logger.Log(level, "sandbox: {Line}", line);
        }
    }
}
