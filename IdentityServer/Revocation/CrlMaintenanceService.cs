using System.Text.Json;
using Serilog;

namespace IdentityServer.Revocation;

/// <summary>
/// Rewrites the CRL files at startup and once a day so NextUpdate never lapses while the server runs.
/// </summary>
public sealed class CrlMaintenanceService(IServiceProvider services) : BackgroundService
{
    public static readonly TimeSpan Interval = TimeSpan.FromDays(1);

    // Runs before Kestrel starts accepting requests, unlike ExecuteAsync which .NET does not wait on.
    public override async Task StartAsync(CancellationToken cancellationToken)
    {
        await WriteCrlsAsync(cancellationToken);
        await base.StartAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await WriteCrlsAsync(stoppingToken);
        }
    }

    // A missing CA file (InvalidOperationException) only disables revocation, but a malformed
    // revoked.json (JsonException) must fail startup loudly instead of silently un-revoking certificates.
    private async Task WriteCrlsAsync(CancellationToken ct)
    {
        try
        {
            var store = services.GetRequiredService<RevocationStore>();
            await store.RewriteCrlsAsync(ct);
            Log.Information("Wrote CRL files under {Directory}", Path.GetDirectoryName(store.FilePath));
        }
        catch (Exception ex) when (ex is not JsonException)
        {
            Log.Error(ex, "Failed to write CRL files");
        }
    }
}
