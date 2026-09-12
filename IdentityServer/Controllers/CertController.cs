using IdentityServer.Models;
using IdentityServer.Shared.x509;
using IdentityServer.Telemetry;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Serilog;

namespace IdentityServer.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CertController(IOptions<AppConfig> appConfig, UdapMetrics metrics) : ControllerBase
    {

        private readonly AppConfig appConfig = appConfig.Value;
        private readonly UdapMetrics metrics = metrics;

        [HttpGet("scenarios")]
        public IActionResult Scenarios() => Ok(CertScenarioCatalog.All.Select(s => s.ToSummary()));

        [HttpPost("generate")]
        [EnableRateLimiting(CertGenerator.RateLimitPolicy)]
        public async Task<IActionResult> Generate(CertGenerateRequest request)
        {

            if (request.AltNames == null || request.AltNames.Count < 1)
            {
                Log.Warning("Certificate generation failed: no altNames provided");
                return BadRequest("Certificate generation failed: no altNames provided");
            }

            if (request.AltNames.Count > CertGenerator.MaxAltNames)
            {
                Log.Warning("Certificate generation failed: too many altNames");
                return BadRequest($"At most {CertGenerator.MaxAltNames} altNames are allowed");
            }

            if (request.AltNames.Any(n => !CertGenerator.IsValidAltName(n)))
            {
                Log.Warning("Certificate generation failed: invalid altName");
                return BadRequest("Each altName must be an absolute URI of at most 200 characters");
            }

            var scenario = CertScenarioCatalog.Find(request.Scenario ?? CertScenarioCatalog.Valid);
            if (scenario is null)
            {
                Log.Warning("Unknown certificate scenario: {Scenario}", request.Scenario);
                return BadRequest($"Unknown scenario '{request.Scenario}'. Valid scenarios: {string.Join(", ", CertScenarioCatalog.All.Select(s => s.Key))}");
            }

            Log.Information("Generating certificate for altNames: {AltNames} (scenario {Scenario}, key {KeyType})",
                string.Join(", ", request.AltNames), scenario.Key, request.KeyType);
            string password = request.Password ?? appConfig.DefaultCertPassword;
            request.Provider = request.Provider == 0 ? CertGenerationProvider.Local : request.Provider;
            if (!Enum.IsDefined(request.Provider))
            {
                Log.Warning("Invalid provider: {Provider}", request.Provider);
                return BadRequest($"Invalid provider: {request.Provider}");
            }
            if (request.Provider == CertGenerationProvider.FhirLabs && scenario.Key != CertScenarioCatalog.Valid)
            {
                return BadRequest("Scenarios are only supported with the Local provider.");
            }
            if (request.Provider == CertGenerationProvider.FhirLabs && request.KeyType == CertKeyType.Ecdsa)
            {
                return BadRequest("keyType Ecdsa is only supported with the Local provider.");
            }
            if (!Enum.IsDefined(request.KeyType))
            {
                Log.Warning("Invalid key type: {KeyType}", request.KeyType);
                return BadRequest($"Invalid keyType: {request.KeyType}. Valid values: Rsa, Ecdsa");
            }

            try
            {
                var result = request.Provider == CertGenerationProvider.FhirLabs
                    ? await ProxyToFhirLabs(request.AltNames, password)
                    : await GenerateLocalAsync(request.AltNames, password, scenario, request.KeyType);

                if (result is BadRequestObjectResult bad)
                {
                    Log.Warning("Certificate generation failed ({Provider}): {Reason}", request.Provider, bad.Value);
                }
                metrics.RecordCertGeneration(result is FileResult, request.Provider.ToString(), scenario.Key);
                return result;
            }
            catch (OperationCanceledException) when (HttpContext?.RequestAborted.IsCancellationRequested == true)
            {
                throw;
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Certificate generation failed ({Provider}): {Reason}", request.Provider, ex.Message);
                metrics.RecordCertGeneration(false, request.Provider.ToString(), scenario.Key);
                throw new InvalidOperationException($"Certificate generation failed for provider {request.Provider}.", ex);
            }
        }


        // Resolved here rather than injected so the catalog and FhirLabs paths do not depend on loading the local CA.
        private async Task<IActionResult> GenerateLocalAsync(List<string> altNames, string password, CertScenario scenario, CertKeyType keyType)
        {
            var generator = HttpContext.RequestServices.GetRequiredService<CertGenerator>();
            var pfx = await generator.GenerateAsync(altNames, password, scenario, keyType, HttpContext.RequestAborted);
            return File(pfx, "application/x-pkcs12", "client-cert.pfx");
        }


        private async Task<IActionResult> ProxyToFhirLabs(List<string> altNames, string password)
        {

            Log.Information("Proxy request to FhirLabs for altNames: {AltNames}", string.Join(", ", altNames));

            string fhirLabsJitCertUrl = appConfig.FhirLabsJitCertUrl;

            string queryString = string.Join("&", altNames.Select(n => $"subjAltNames={Uri.EscapeDataString(n)}"));
            queryString += $"&password={password}";
            string url = $"{fhirLabsJitCertUrl}?{queryString}";

            var response = await new HttpClient().GetAsync(url);
            Log.Information("Response: {StatusCode}", response.StatusCode);

            var contentBase64 = await response.Content.ReadAsStringAsync();
            var bytes = Convert.FromBase64String(contentBase64);

            return File(bytes, "application/x-pkcs12", "client-cert.pfx");

        }
    }
}
