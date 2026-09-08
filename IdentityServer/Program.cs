using IdentityServer;
using IdentityServer.Models;
using IdentityServer.Telemetry;
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
    TelemetryExtensions.ResolveOtelFileSecrets();

    var builder = WebApplication.CreateBuilder(args);
    builder.AddUdapTelemetry();

    var app = builder
        .ConfigureServices()
        .ConfigurePipeline()
        .LogHostStarted();

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
