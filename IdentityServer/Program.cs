using IdentityServer;
using IdentityServer.Models;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using System.Text.Json;
using Udap.Server.Configuration;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

Log.Information("Starting up");

try
{
    var builder = WebApplication.CreateBuilder(args);

    // Get OpenTelemetry configuration from environment variables
    var otlpEndpoint = Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT");
    var serviceName = Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME") ?? "identity-server";

    builder.Host.UseSerilog((ctx, lc) =>
    {
        var loggerConfig = lc
            .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level}] {SourceContext}{NewLine}{Message:lj}{NewLine}{Exception}{NewLine}")
            .Enrich.FromLogContext()
            .ReadFrom.Configuration(ctx.Configuration);

        // Add OpenTelemetry sink if OTLP endpoint is configured
        if (!string.IsNullOrEmpty(otlpEndpoint))
        {
            loggerConfig.WriteTo.OpenTelemetry();
        }
    });


    // Configure OpenTelemetry if endpoint is set
    if (!string.IsNullOrEmpty(otlpEndpoint))
    {
        builder.Logging.AddOpenTelemetry(options =>
        {
            options
                .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService(serviceName))
                .AddOtlpExporter();
        });

        builder.Services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService(serviceName))
            .WithMetrics(metrics =>
            {
                metrics
                    .AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation()
                    .AddOtlpExporter();
            })
            .WithTracing(tracing =>
            {
                tracing
                    .AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddEntityFrameworkCoreInstrumentation()
                    .AddSqlClientInstrumentation()
                    .AddOtlpExporter();
            });
    }

    var app = builder
        .ConfigureServices()
        .ConfigurePipeline();

    var appConfig = builder.Configuration.GetOption<AppConfig>(nameof(AppConfig));

    Log.Debug("Seed database: {SeedDatabase}", appConfig.SeedData);
    if (appConfig.SeedData)
    {
        Log.Information("Seeding database");
        await SeedData.InitializeDatabase(app);
    }

    app.Run();
}
catch (Exception ex) when (
                            // https://github.com/dotnet/runtime/issues/60600
                            ex.GetType().Name is not "StopTheHostException"
                            // HostAbortedException was added in .NET 7, but since we target .NET 6 we
                            // need to do it this way until we target .NET 8
                            && ex.GetType().Name is not "HostAbortedException"
                        )
{
    Log.Fatal(ex, "Unhandled exception");
}
finally
{
    Log.Information("Shut down complete");
    Log.CloseAndFlush();
}