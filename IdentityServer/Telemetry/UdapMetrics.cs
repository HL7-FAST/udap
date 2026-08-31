using System.Diagnostics;
using System.Diagnostics.Metrics;
using System.Reflection;
using Duende.IdentityServer.EntityFramework.DbContexts;
using IdentityServer.Models;
using Serilog;
using Udap.Common.Certificates;
using Udap.Model.Registration;

namespace IdentityServer.Telemetry;

/// <summary>
/// UDAP flow metrics that the Udap.Server and Duende libraries do not emit themselves.
/// </summary>
public sealed class UdapMetrics
{
    public const string MeterName = "udap.server";

    private const string OutcomeTag = "udap.outcome";

    // Registration outcomes
    public const string Success = "success";
    public const string Error = "error";
    public const string ScopeRejected = "scope_rejected";

    private static readonly HashSet<string> KnownRegistrationErrors = typeof(UdapDynamicClientRegistrationErrors)
        .GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.FlattenHierarchy)
        .Where(f => f.IsLiteral && f.FieldType == typeof(string))
        .Select(f => (string)f.GetRawConstantValue()!)
        .ToHashSet(StringComparer.Ordinal);

    private static readonly HashSet<string> KnownGrantTypes = new(StringComparer.Ordinal)
    {
        "client_credentials", "authorization_code", "refresh_token"
    };

    private readonly Counter<long> _registrationAttempts;
    private readonly Counter<long> _trustChainValidations;
    private readonly Counter<long> _tieredOAuthAttempts;
    private readonly Counter<long> _certGenerationAttempts;

    public UdapMetrics(IMeterFactory meterFactory, TrustChainValidator trustChainValidator, IServiceScopeFactory scopeFactory,
        IHostApplicationLifetime lifetime)
    {
        var meter = meterFactory.Create(MeterName);

        // Exported as process_start_time_seconds, the Prometheus convention for the last successful
        // startup. Not reported until the host is running, so a failed startup never sets it.
        long startedAt = 0;
        lifetime.ApplicationStarted.Register(() => startedAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        meter.CreateObservableGauge<long>("process.start_time",
            () => startedAt == 0 ? Array.Empty<Measurement<long>>() : [new Measurement<long>(startedAt)],
            unit: "s", description: "Unix time when the host last reached the running state.");

        _registrationAttempts = meter.CreateCounter<long>("udap.registration.attempts",
            description: "Dynamic client registration requests by outcome.");
        _trustChainValidations = meter.CreateCounter<long>("udap.trust_chain.validations",
            description: "Certificate trust chain validation failures by outcome. The library raises no event on success.");
        _tieredOAuthAttempts = meter.CreateCounter<long>("udap.tiered_oauth.attempts",
            description: "Tiered OAuth IdP sign-in attempts by outcome.");
        _certGenerationAttempts = meter.CreateCounter<long>("udap.cert_generation.attempts",
            description: "Client certificate generation requests by outcome and provider.");

        meter.CreateObservableGauge("udap.clients.registered", () => CountRegisteredClients(scopeFactory),
            description: "Registered clients in the configuration store. Resets when the store is wiped.");
        meter.CreateObservableGauge("udap.client.info", () => ListRegisteredClients(scopeFactory),
            description: "One series per registered client carrying its display name, for joining onto client-tagged counters.");

        trustChainValidator.Untrusted += _ => _trustChainValidations.Add(1, new TagList { { OutcomeTag, "untrusted" } });
        trustChainValidator.Problem += _ => _trustChainValidations.Add(1, new TagList { { OutcomeTag, "problem" } });
        trustChainValidator.Error += (_, _) => _trustChainValidations.Add(1, new TagList { { OutcomeTag, "error" } });

        InitializeToZero();
    }

    /// <summary>
    /// Create every attribute combination at 0 so the first increment after a start is visible.
    /// Prometheus rate() and increase() only see differences between samples; a series that
    /// first appears at 1 counts as no change. All attribute values here are bounded, so the
    /// series count is small.
    /// </summary>
    private void InitializeToZero()
    {
        var grantTypes = new[] { "client_credentials", "authorization_code", "authorization_code,client_credentials", "other" };
        foreach (var grantType in grantTypes)
        {
            _registrationAttempts.Add(0, new TagList { { OutcomeTag, Success }, { "udap.grant_type", grantType } });
            foreach (var outcome in new[] { Error, ScopeRejected })
            {
                foreach (var error in KnownRegistrationErrors.Append("other"))
                {
                    _registrationAttempts.Add(0, new TagList { { OutcomeTag, outcome }, { "udap.grant_type", grantType }, { "udap.error", error } });
                }
            }
        }

        foreach (var outcome in new[] { "untrusted", "problem", "error" })
        {
            _trustChainValidations.Add(0, new TagList { { OutcomeTag, outcome } });
        }
        
        foreach (var outcome in new[] { Success, Error })
        {
            _tieredOAuthAttempts.Add(0, new TagList { { OutcomeTag, outcome } });
            foreach (var provider in Enum.GetNames<CertGenerationProvider>())
            {
                _certGenerationAttempts.Add(0, new TagList { { OutcomeTag, outcome }, { "udap.provider", provider } });
            }
        }
    }

    public void RecordRegistration(string outcome, string? error, IEnumerable<string> grantTypes)
    {
        var tags = new TagList
        {
            { OutcomeTag, outcome },
            { "udap.grant_type", BoundedGrantType(grantTypes) }
        };
        if (error != null)
        {
            tags.Add("udap.error", KnownRegistrationErrors.Contains(error) ? error : "other");
        }
        Log.Debug("Recording registration attempt: outcome={Outcome}, error={Error}, grantTypes={GrantTypes}", outcome, error, string.Join(",", grantTypes));
        _registrationAttempts.Add(1, tags);
    }

    public void RecordTieredOAuth(bool success)
    {
        Log.Debug("Recording tiered OAuth attempt: success={Success}", success);
        _tieredOAuthAttempts.Add(1, new TagList { { OutcomeTag, success ? Success : Error } });
    }

    public void RecordCertGeneration(bool success, string provider)
    {
        Log.Debug("Recording certificate generation attempt: success={Success}, provider={Provider}", success, provider);
        _certGenerationAttempts.Add(1, new TagList { { OutcomeTag, success ? Success : Error }, { "udap.provider", provider } });
    }

    private static string BoundedGrantType(IEnumerable<string> grantTypes)
    {
        var known = grantTypes.Where(KnownGrantTypes.Contains).Distinct().Order().ToList();
        return known.Count == 0 ? "other" : string.Join(",", known);
    }

    private static long CountRegisteredClients(IServiceScopeFactory scopeFactory)
    {
        // Gauge callbacks run on the metrics reader thread, outside any request scope.
        using var scope = scopeFactory.CreateScope();
        return scope.ServiceProvider.GetRequiredService<ConfigurationDbContext>().Clients.LongCount();
    }

    /// <summary>
    /// Info metric: value is always 1, the identity lives in the tags. The "client" tag matches the
    /// tag Duende puts on its token counters so the two can be joined in a query.
    /// Client names are client supplied, so they are truncated to keep label values small.
    /// </summary>
    private static IEnumerable<Measurement<int>> ListRegisteredClients(IServiceScopeFactory scopeFactory)
    {
        using var scope = scopeFactory.CreateScope();
        var clients = scope.ServiceProvider.GetRequiredService<ConfigurationDbContext>().Clients
            .Select(c => new { c.ClientId, c.ClientName })
            .ToList();
        return clients.Select(c => new Measurement<int>(1, new TagList
        {
            { "client", c.ClientId },
            { "udap.client_name", Truncate(c.ClientName, 64) }
        }));
    }

    private static string Truncate(string? value, int max)
    {
        if (string.IsNullOrEmpty(value))
        {
            return "";
        }

        return value.Length <= max ? value : value[..max];
    }
}
