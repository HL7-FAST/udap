using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using System.Text.Json.Serialization;
using Serilog;
using Udap.Common.Certificates;

namespace IdentityServer.Revocation;

/// <summary>
/// Revoked leaf serials, kept in revoked.json beside the CRL so both are browsable under /certs.
/// </summary>
public sealed class RevocationStore
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    private readonly CrlWriter _writer;
    private readonly ICertificateDownloadCache? _downloadCache;
    private readonly string? _intermediateCrlUrl;
    private readonly List<RevokedEntry> _entries;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public string FilePath { get; }

    public RevocationStore(string directory, CrlWriter writer, ICertificateDownloadCache? downloadCache, string? intermediateCrlUrl)
    {
        FilePath = Path.Combine(directory, "revoked.json");
        _writer = writer;
        _downloadCache = downloadCache;
        _intermediateCrlUrl = intermediateCrlUrl;

        // A malformed file fails loudly on purpose: ignoring it would silently un-revoke certificates.
        if (!File.Exists(FilePath))
        {
            _entries = [];
        }
        else
        {
            var loaded = JsonSerializer.Deserialize<RevocationFile>(File.ReadAllText(FilePath), JsonOptions);
            _entries = loaded?.Revoked ?? throw new JsonException($"{FilePath} does not contain a revoked array");
            if (_entries.Any(e => string.IsNullOrEmpty(e.Serial)))
            {
                throw new JsonException($"{FilePath} contains an entry without a serial");
            }
            foreach (var entry in _entries)
            {
                try
                {
                    Convert.FromHexString(entry.Serial);
                }
                catch (FormatException ex)
                {
                    throw new JsonException($"{FilePath} contains an entry with a non-hex serial", ex);
                }
            }
        }
    }

    public IReadOnlyList<RevokedEntry> GetAll()
    {
        lock (_entries)
        {
            return _entries.ToList();
        }
    }

    public bool IsRevoked(string serial)
    {
        lock (_entries)
        {
            return _entries.Any(e => e.Serial.Equals(serial, StringComparison.OrdinalIgnoreCase));
        }
    }

    public Task RevokeAsync(X509Certificate2 certificate, X509RevocationReason reason, CancellationToken ct = default) =>
        RevokeAsync(certificate.SerialNumber, certificate.Subject, reason, ct);

    public async Task RevokeAsync(string serial, string subject, X509RevocationReason reason, CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            if (IsRevoked(serial))
            {
                return;
            }

            var entry = new RevokedEntry(serial, DateTimeOffset.UtcNow, reason, subject);
            List<RevokedEntry> snapshot;
            lock (_entries)
            {
                snapshot = [.. _entries, entry];
            }

            // Write the JSON and CRL from the snapshot before touching _entries: if either write
            // throws, _entries stays unchanged and a retry does not short-circuit on IsRevoked
            // without ever having persisted the revocation.
            Directory.CreateDirectory(Path.GetDirectoryName(FilePath)!);
            var tempPath = FilePath + ".tmp";
            File.WriteAllText(tempPath, JsonSerializer.Serialize(new RevocationFile(_writer.IntermediateSubject, snapshot), JsonOptions));
            File.Move(tempPath, FilePath, overwrite: true);
            _writer.WriteAll(snapshot);

            lock (_entries)
            {
                _entries.Add(entry);
            }

            // The UDAP library caches a downloaded CRL until its NextUpdate, which would hide this
            // revocation for a week. Evicting the entry forces a fresh download on the next check.
            if (_downloadCache is not null && _intermediateCrlUrl is not null)
            {
                // The entry is already persisted, so eviction must not be cancelled with the request.
                await _downloadCache.RemoveCrlAsync(_intermediateCrlUrl, CancellationToken.None);
            }

            Log.Information("Revoked certificate {Serial} ({Subject}): {Reason}", serial, subject, reason);
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Rewrites the CRL files from the current list under the same gate RevokeAsync uses, so a rewrite can never publish a stale list.</summary>
    public async Task RewriteCrlsAsync(CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try { _writer.WriteAll(GetAll()); }
        finally { _gate.Release(); }
    }

}

// Internal rather than nested-private so System.Text.Json can bind its constructor.
internal sealed record RevocationFile(string Issuer, List<RevokedEntry> Revoked);
