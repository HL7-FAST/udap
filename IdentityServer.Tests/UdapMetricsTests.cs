using System.Diagnostics.Metrics;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using IdentityServer.Telemetry;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.Metrics.Testing;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Hosting.Internal;
using Microsoft.Extensions.Logging.Abstractions;
using Udap.Common.Certificates;
using Xunit;

namespace IdentityServer.Tests;

public class UdapMetricsTests
{
    // The gauge callback requires a ConfigurationDbContext, which we don't register here.
    // Nothing in these tests observes the gauge, so it is never invoked.
    private static (UdapMetrics Metrics, TrustChainValidator Validator, IMeterFactory MeterFactory) BuildMetrics()
    {
        var services = new ServiceCollection();
        services.AddMetrics();
        services.AddSingleton(_ => new TrustChainValidator(NullLogger<TrustChainValidator>.Instance));
        services.AddSingleton<IHostApplicationLifetime>(new ApplicationLifetime(NullLogger<ApplicationLifetime>.Instance));
        services.AddSingleton<UdapMetrics>();
        var provider = services.BuildServiceProvider();

        return (provider.GetRequiredService<UdapMetrics>(),
                provider.GetRequiredService<TrustChainValidator>(),
                provider.GetRequiredService<IMeterFactory>());
    }

    [Fact]
    public void RecordRegistration_UnknownError_TaggedOther()
    {
        var (metrics, _, meterFactory) = BuildMetrics();
        using var collector = new MetricCollector<long>(meterFactory, UdapMetrics.MeterName, "udap.registration.attempts");

        metrics.RecordRegistration(UdapMetrics.Error, "totally_bogus_error", ["client_credentials"]);

        var measurement = Assert.Single(collector.GetMeasurementSnapshot());
        Assert.Equal("other", measurement.Tags["udap.error"]);
    }

    [Fact]
    public void RecordRegistration_KnownError_KeptVerbatim()
    {
        var (metrics, _, meterFactory) = BuildMetrics();
        using var collector = new MetricCollector<long>(meterFactory, UdapMetrics.MeterName, "udap.registration.attempts");

        metrics.RecordRegistration(UdapMetrics.Error, "invalid_client_metadata", ["client_credentials"]);

        var measurement = Assert.Single(collector.GetMeasurementSnapshot());
        Assert.Equal("invalid_client_metadata", measurement.Tags["udap.error"]);
    }

    [Fact]
    public void RecordRegistration_GrantTypes_JoinedSortedAndUnknownMappedToOther()
    {
        var (metrics, _, meterFactory) = BuildMetrics();
        using var collector = new MetricCollector<long>(meterFactory, UdapMetrics.MeterName, "udap.registration.attempts");

        metrics.RecordRegistration(UdapMetrics.Success, null, ["refresh_token", "client_credentials"]);
        metrics.RecordRegistration(UdapMetrics.Success, null, ["some_unknown_grant"]);

        var measurements = collector.GetMeasurementSnapshot();
        Assert.Equal("client_credentials,refresh_token", measurements[0].Tags["udap.grant_type"]);
        Assert.Equal("other", measurements[1].Tags["udap.grant_type"]);
    }

    [Fact]
    public async Task TrustChainValidator_Untrusted_IncrementsTrustChainValidations()
    {
        var (_, validator, meterFactory) = BuildMetrics();
        using var collector = new MetricCollector<long>(meterFactory, UdapMetrics.MeterName, "udap.trust_chain.validations");

        // An empty anchor collection makes IsTrustedCertificateAsync raise Untrusted immediately,
        // without needing to build a real chain.
        using var rsa = RSA.Create(2048);
        var request = new CertificateRequest("CN=test-leaf", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        using var cert = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(1));

        await validator.IsTrustedCertificateAsync("test-client", cert, null, new X509Certificate2Collection());

        var measurement = Assert.Single(collector.GetMeasurementSnapshot());
        Assert.Equal("untrusted", measurement.Tags["udap.outcome"]);
    }
}
