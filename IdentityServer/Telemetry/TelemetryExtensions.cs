using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;

namespace IdentityServer.Telemetry;

/// <summary>
/// Serilog and OpenTelemetry wiring. Export is enabled only when OTEL_EXPORTER_OTLP_ENDPOINT is set.
/// </summary>
internal static class TelemetryExtensions
{
    private const string FileSuffix = "_FILE";

    /// <summary>
    /// An OTEL_*_FILE variable names a file that holds the real value, for example
    /// a Docker secret under /run/secrets. Call before the host builder reads the environment.
    /// </summary>
    public static void ResolveOtelFileSecrets()
    {
        foreach (var fileKey in Environment.GetEnvironmentVariables().Keys.Cast<string>()
                     .Where(k => k.StartsWith("OTEL_") && k.EndsWith(FileSuffix)))
        {
            var targetKey = fileKey[..^FileSuffix.Length];
            if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable(targetKey)))
            {
                Log.Warning("{TargetKey} is already set; ignoring {FileKey}", targetKey, fileKey);
                continue;
            }
            var secretFilePath = Environment.GetEnvironmentVariable(fileKey);
            if (File.Exists(secretFilePath))
            {
                Environment.SetEnvironmentVariable(targetKey, File.ReadAllText(secretFilePath).Trim());
            }
            else
            {
                Log.Warning("File {SecretFilePath} named by {FileKey} was not found", secretFilePath, fileKey);
            }
        }
    }

    public static WebApplicationBuilder AddUdapTelemetry(this WebApplicationBuilder builder)
    {
        var otlpEndpoint = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT");
        var serviceName = Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME") ?? "fast-security";

        var resourceAttributes = new Dictionary<string, object> { ["service.name"] = serviceName };
        if (Environment.GetEnvironmentVariable("OTEL_RESOURCE_ATTRIBUTES")?.Contains("deployment.environment.name=") != true)
        {
            resourceAttributes["deployment.environment.name"] = builder.Environment.EnvironmentName.ToLowerInvariant();
        }

        builder.Host.UseSerilog((ctx, lc) =>
        {
            var loggerConfig = lc
                .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level}] {SourceContext}{NewLine}{Message:lj}{NewLine}{Exception}{NewLine}")
                .Enrich.FromLogContext()
                .ReadFrom.Configuration(ctx.Configuration);

            if (!string.IsNullOrEmpty(otlpEndpoint))
            {
                loggerConfig.WriteTo.OpenTelemetry(options =>
                {
                    options.ResourceAttributes = resourceAttributes;
                    options.HttpMessageHandler = new OtlpResponseLoggingHandler();
                });
            }
        });

        if (string.IsNullOrEmpty(otlpEndpoint))
        {
            return builder;
        }

        builder.Logging.AddOpenTelemetry(options =>
        {
            options
                .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService(serviceName).AddAttributes(resourceAttributes))
                .AddOtlpExporter();
        });

        builder.Services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService(serviceName).AddAttributes(resourceAttributes))
            .WithMetrics(metrics =>
            {
                metrics
                    .AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation()
                    .AddMeter("Duende.IdentityServer")
                    .AddMeter(UdapMetrics.MeterName)
                    // Attach the current trace id to metric samples so charts can link to traces
                    .SetExemplarFilter(ExemplarFilterType.TraceBased)
                    .AddOtlpExporter();
            })
            .WithTracing(tracing =>
            {
                tracing
                    .AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddEntityFrameworkCoreInstrumentation()
                    .AddSqlClientInstrumentation()
                    .AddSource("Duende.IdentityServer")
                    .AddSource(Udap.Common.Tracing.TraceNames.Store)
                    .AddSource(Udap.Common.Tracing.TraceNames.Validation)
                    .AddSource(Udap.Common.Tracing.TraceNames.Endpoints)
                    .AddOtlpExporter();
            });

        return builder;
    }

    /// <summary>
    /// Emitted once the OTLP sink is up, so Loki can count startups and detect a restart loop.
    /// </summary>
    public static WebApplication LogHostStarted(this WebApplication app)
    {
        app.Lifetime.ApplicationStarted.Register(() =>
            Log.Information("Host started after {StartupSeconds:0.0}s",
                (DateTime.Now - System.Diagnostics.Process.GetCurrentProcess().StartTime).TotalSeconds));
        return app;
    }
}
