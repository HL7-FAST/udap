using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using IdentityServer.Revocation;
using IdentityServer.Shared.x509;
using Udap.Common.Certificates;
using Xunit;

namespace IdentityServer.Tests;

public class RevocationStoreTests
{
    // Records eviction calls so tests can assert a revocation actually invalidates the cache;
    // the other three interface members are unused by RevocationStore.
    private sealed class FakeDownloadCache : ICertificateDownloadCache
    {
        // Probe runs at eviction time so a test can prove the CRL was already written on disk
        // by the moment eviction happens, not just by the moment RevokeAsync returns.
        public Func<bool>? Probe { get; set; }
        public List<(string Url, bool CrlHadSerial)> Removals { get; } = [];

        public Task<X509Certificate2?> GetIntermediateCertificateAsync(string url, CancellationToken ct) => Task.FromResult<X509Certificate2?>(null);
        public Task<Org.BouncyCastle.X509.X509Crl?> GetCrlAsync(string url, CancellationToken ct) => Task.FromResult<Org.BouncyCastle.X509.X509Crl?>(null);
        public Task RemoveIntermediateAsync(string url, CancellationToken ct) => Task.CompletedTask;

        public Task RemoveCrlAsync(string url, CancellationToken ct)
        {
            Removals.Add((url, Probe?.Invoke() ?? false));
            return Task.CompletedTask;
        }
    }

    private static string TempDir() => Path.Combine(Path.GetTempPath(), "udap-rev-" + Guid.NewGuid().ToString("N"));

    private static X509Certificate2 Leaf(string cn)
    {
        using var key = RSA.Create(2048);
        var request = new CertificateRequest($"CN={cn}", key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        return request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(1));
    }

    [Fact]
    public async Task RevokeAsync_PersistsEntryAndRewritesCrl()
    {
        var ca = CertificateTooling.BuildThrowawayCa("Store");
        var dir = TempDir();
        var writer = new CrlWriter(ca.Root, ca.Intermediate, dir);
        var store = new RevocationStore(dir, writer, downloadCache: null, intermediateCrlUrl: null);
        var leaf = Leaf("leaf-one");

        await store.RevokeAsync(leaf, X509RevocationReason.KeyCompromise);
        await store.RevokeAsync(leaf, X509RevocationReason.KeyCompromise);

        Assert.True(store.IsRevoked(leaf.SerialNumber));
        Assert.Single(store.GetAll());

        var reloaded = new RevocationStore(dir, writer, downloadCache: null, intermediateCrlUrl: null);
        Assert.Equal(leaf.SerialNumber, Assert.Single(reloaded.GetAll()).Serial);

        var json = JsonDocument.Parse(File.ReadAllText(store.FilePath));
        Assert.Equal("keyCompromise", json.RootElement.GetProperty("revoked")[0].GetProperty("reason").GetString());
        Assert.Equal(ca.Intermediate.Subject, json.RootElement.GetProperty("issuer").GetString());

        var crl = CertificateRevocationListBuilder.Load(File.ReadAllBytes(writer.IntermediateCrlPath), out _);
        Assert.True(crl.RemoveEntry(leaf.SerialNumberBytes.ToArray()));
    }

    [Fact]
    public void Constructor_MalformedFileThrows()
    {
        var ca = CertificateTooling.BuildThrowawayCa("Malformed");
        var dir = TempDir();
        Directory.CreateDirectory(dir);
        File.WriteAllText(Path.Combine(dir, "revoked.json"), "{ not json");

        Assert.Throws<JsonException>(() =>
            new RevocationStore(dir, new CrlWriter(ca.Root, ca.Intermediate, dir), downloadCache: null, intermediateCrlUrl: null));
    }

    [Fact]
    public void Constructor_MissingRevokedArrayThrows()
    {
        var ca = CertificateTooling.BuildThrowawayCa("Empty");
        var dir = TempDir();
        Directory.CreateDirectory(dir);
        File.WriteAllText(Path.Combine(dir, "revoked.json"), "{}");

        Assert.Throws<JsonException>(() =>
            new RevocationStore(dir, new CrlWriter(ca.Root, ca.Intermediate, dir), downloadCache: null, intermediateCrlUrl: null));
    }

    [Fact]
    public async Task RevokeAsync_EvictsCacheAfterCrlIsWritten()
    {
        var ca = CertificateTooling.BuildThrowawayCa("Evict");
        var dir = TempDir();
        var writer = new CrlWriter(ca.Root, ca.Intermediate, dir);
        var cache = new FakeDownloadCache();
        const string crlUrl = "http://localhost:5000/certs/LocalCA/crl/LocalSubCA.crl";
        var store = new RevocationStore(dir, writer, cache, crlUrl);
        var leaf = Leaf("leaf-evict");
        cache.Probe = () =>
        {
            var crl = CertificateRevocationListBuilder.Load(File.ReadAllBytes(writer.IntermediateCrlPath), out _);
            return crl.RemoveEntry(leaf.SerialNumberBytes.ToArray());
        };

        await store.RevokeAsync(leaf, X509RevocationReason.KeyCompromise);

        var removal = Assert.Single(cache.Removals);
        Assert.Equal(crlUrl, removal.Url);
        Assert.True(removal.CrlHadSerial);
    }

    [Fact]
    public void Constructor_EntryWithoutSerialThrows()
    {
        var ca = CertificateTooling.BuildThrowawayCa("NoSerial");
        var dir = TempDir();
        Directory.CreateDirectory(dir);
        File.WriteAllText(Path.Combine(dir, "revoked.json"), """{"issuer":"x","revoked":[{}]}""");

        Assert.Throws<JsonException>(() =>
            new RevocationStore(dir, new CrlWriter(ca.Root, ca.Intermediate, dir), downloadCache: null, intermediateCrlUrl: null));
    }

    [Fact]
    public void Constructor_NonHexSerialThrows()
    {
        var ca = CertificateTooling.BuildThrowawayCa("NonHex");
        var dir = TempDir();
        Directory.CreateDirectory(dir);
        File.WriteAllText(Path.Combine(dir, "revoked.json"),
            """{"issuer":"x","revoked":[{"serial":"ZZ","revokedAt":"2026-09-08T00:00:00Z","reason":"keyCompromise","subject":"CN=x"}]}""");

        Assert.Throws<JsonException>(() =>
            new RevocationStore(dir, new CrlWriter(ca.Root, ca.Intermediate, dir), downloadCache: null, intermediateCrlUrl: null));
    }

    [Fact]
    public async Task RevokeAsync_BySerial_PersistsEntry()
    {
        var ca = CertificateTooling.BuildThrowawayCa("Serial");
        var dir = TempDir();
        var store = new RevocationStore(dir, new CrlWriter(ca.Root, ca.Intermediate, dir), downloadCache: null, intermediateCrlUrl: null);

        await store.RevokeAsync("0A1B2C3D", "CN=typed-in", X509RevocationReason.Superseded);

        var entry = Assert.Single(store.GetAll());
        Assert.Equal("0A1B2C3D", entry.Serial);
        Assert.Equal("CN=typed-in", entry.Subject);
        Assert.Equal(X509RevocationReason.Superseded, entry.Reason);
    }
}
