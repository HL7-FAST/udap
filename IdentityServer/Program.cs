using IdentityServer;
using IdentityServer.Models;
using IdentityServer.Telemetry;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using Udap.Server.Configuration;

// Serilog sinks fail silently by default; surface sink errors (for example a
// broken OTLP export) on stderr.
Serilog.Debugging.SelfLog.Enable(Console.Error);

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

Log.Information("Starting up");

try
{
    var builder = WebApplication.CreateBuilder(args);

    // Get OpenTelemetry configuration from environment variables
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

        // Add OpenTelemetry sink if OTLP endpoint is configured
        if (!string.IsNullOrEmpty(otlpEndpoint))
        {
            loggerConfig.WriteTo.OpenTelemetry(options =>
            {
                options.ResourceAttributes = resourceAttributes;
                options.HttpMessageHandler = new OtlpResponseLoggingHandler();
            });
        }
    });


    // Configure OpenTelemetry if endpoint is set
    if (!string.IsNullOrEmpty(otlpEndpoint))
    {
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
    }

    var app = builder
        .ConfigureServices()
        .ConfigurePipeline();

    // "Starting up" above goes to the bootstrap logger only. This event reaches the OTLP sink,
    // so Loki can count startups and detect a restart loop.
    app.Lifetime.ApplicationStarted.Register(() =>
        Log.Information("Host started after {StartupSeconds:0.0}s",
            (DateTime.Now - System.Diagnostics.Process.GetCurrentProcess().StartTime).TotalSeconds));

    var appConfig = builder.Configuration.GetOption<AppConfig>(nameof(AppConfig));

    Log.Debug("Seed database: {SeedDatabase}", appConfig.SeedData);
    if (appConfig.SeedData)
    {
        Log.Information("Seeding database");
        await SeedData.InitializeDatabase(app);
    }

    await app.RunAsync();
}
// HostAbortedException is expected from design-time tools such as dotnet ef and from host shutdown.
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Unhandled exception");
    // A non-zero exit code lets Docker and orchestrators see the crash, not only the log.
    Environment.ExitCode = 1;
}
finally
{
    Log.Information("Shut down complete");
    await Log.CloseAndFlushAsync();
}