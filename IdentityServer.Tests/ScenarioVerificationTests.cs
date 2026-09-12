using System.Net.Http.Json;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using IdentityServer.Shared.x509;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Xunit;
using Xunit.Abstractions;

namespace IdentityServer.Tests;

/// <summary>
/// Registers one client per scenario against a running server and prints the outcome.
/// Run with: UDAP_SERVER_URL=https://localhost:5001 dotnet test IdentityServer.Tests --filter Category=Live --logger "console;verbosity=detailed"
/// </summary>
public class ScenarioVerificationTests(ITestOutputHelper output)
{
    [Fact]
    [Trait("Category", "Live")]
    public async Task RegisterEveryScenario()
    {
        var serverUrl = Environment.GetEnvironmentVariable("UDAP_SERVER_URL");
        if (serverUrl is null)
        {
            output.WriteLine("UDAP_SERVER_URL not set, skipping");
            return;
        }

        using var http = new HttpClient(new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        });

        var metadata = await http.GetFromJsonAsync<JsonElement>($"{serverUrl}/.well-known/udap");
        var registrationEndpoint = metadata.GetProperty("registration_endpoint").GetString()!;
        var scenarios = (await http.GetFromJsonAsync<List<CertScenarioSummary>>($"{serverUrl}/api/cert/scenarios"))!;

        var runs = scenarios.Select(s => (s.Key, KeyType: "Rsa")).Append((CertScenarioCatalog.Valid, KeyType: "Ecdsa"));
        foreach (var (key, keyType) in runs)
        {
            var altName = $"https://scenario.example.org/{key}/{keyType.ToLowerInvariant()}";
            var pfxResponse = await http.PostAsJsonAsync($"{serverUrl}/api/cert/generate",
                new { altNames = new[] { altName }, password = "udap-test", scenario = key, keyType });
            pfxResponse.EnsureSuccessStatusCode();

            var bundle = X509CertificateLoader.LoadPkcs12Collection(
                await pfxResponse.Content.ReadAsByteArrayAsync(), "udap-test", X509KeyStorageFlags.Exportable);
            var leaf = bundle.First(c => c.HasPrivateKey);
            var chain = new[] { leaf }.Concat(bundle.Cast<X509Certificate2>().Where(c => !c.HasPrivateKey));

            var statement = SignSoftwareStatement(leaf, chain, altName, registrationEndpoint);
            var response = await http.PostAsJsonAsync(registrationEndpoint, new { software_statement = statement, udap = "1" });
            var body = await response.Content.ReadAsStringAsync();

            output.WriteLine($"{key} ({keyType}): HTTP {(int)response.StatusCode} {body}");
        }
    }

    private static string SignSoftwareStatement(X509Certificate2 leaf, IEnumerable<X509Certificate2> chain, string altName, string audience)
    {
        var now = DateTimeOffset.UtcNow;
        var ecdsaPrivateKey = leaf.GetECDsaPrivateKey();
        var algorithm = ecdsaPrivateKey is null ? SecurityAlgorithms.RsaSha256 : SecurityAlgorithms.EcdsaSha384;

        // Microsoft.IdentityModel.Tokens.X509SecurityKey reports ES384 as unsupported for an EC
        // certificate on this platform (IDX10634), even though the cert carries a valid P-384 key.
        // ECDsaSecurityKey wraps the raw key and does not hit that check, so use it for the EC case.
        var signingKey = ecdsaPrivateKey is null ? new X509SecurityKey(leaf) : (SecurityKey)new ECDsaSecurityKey(ecdsaPrivateKey);

        var descriptor = new SecurityTokenDescriptor
        {
            Claims = new Dictionary<string, object>
            {
                ["iss"] = altName,
                ["sub"] = altName,
                ["aud"] = audience,
                ["exp"] = now.AddMinutes(5).ToUnixTimeSeconds(),
                ["iat"] = now.ToUnixTimeSeconds(),
                ["jti"] = Guid.NewGuid().ToString("N"),
                ["client_name"] = $"Scenario {altName}",
                ["contacts"] = new[] { "mailto:scenario@example.org" },
                ["grant_types"] = new[] { "client_credentials" },
                ["token_endpoint_auth_method"] = "private_key_jwt",
                ["scope"] = "system/Patient.read"
            },
            SigningCredentials = new SigningCredentials(signingKey, algorithm),
            AdditionalHeaderClaims = new Dictionary<string, object>
            {
                ["x5c"] = chain.Select(c => Convert.ToBase64String(c.RawData)).ToArray()
            }
        };

        // exp and iat come from the claims above, not from the handler's defaults.
        return new JsonWebTokenHandler { SetDefaultTimesOnTokenCreation = false }.CreateToken(descriptor);
    }
}
