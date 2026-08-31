using IdentityServer.Models;
using IdentityServer.Shared.x509;
using IdentityServer.Telemetry;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Serilog;
using System.Security.Cryptography.X509Certificates;

namespace IdentityServer.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CertController(IOptions<AppConfig> appConfig, UdapMetrics metrics) : ControllerBase
    {

        private readonly AppConfig appConfig = appConfig.Value;
        private readonly UdapMetrics metrics = metrics;

        [HttpPost("generate")]
        public async Task<IActionResult> Generate(CertGenerateRequest request)
        {

            if (request.AltNames == null || request.AltNames.Count < 1)
            {
                Log.Warning("Certificate generation failed: no altNames provided");
                return BadRequest("Certificate generation failed: no altNames provided");
            }

            Log.Information("Generating certificate for altNames: {AltNames}", string.Join(", ", request.AltNames));
            string password = request.Password ?? appConfig.DefaultCertPassword;
            request.Provider = request.Provider == 0 ? CertGenerationProvider.Local : request.Provider;
            if (!Enum.IsDefined(request.Provider))
            {
                Log.Warning("Invalid provider: {Provider}", request.Provider);
                return BadRequest($"Invalid provider: {request.Provider}");
            }

            try
            {
                var result = request.Provider == CertGenerationProvider.FhirLabs
                    ? await ProxyToFhirLabs(request.AltNames, password)
                    : await GenerateCertificateAsync(request.AltNames, password);

                if (result is BadRequestObjectResult bad)
                {
                    Log.Warning("Certificate generation failed ({Provider}): {Reason}", request.Provider, bad.Value);
                }
                metrics.RecordCertGeneration(result is FileResult, request.Provider.ToString());
                return result;
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Certificate generation failed ({Provider}): {Reason}", request.Provider, ex.Message);
                metrics.RecordCertGeneration(false, request.Provider.ToString());
                throw new InvalidOperationException($"Certificate generation failed for provider {request.Provider}.", ex);
            }
        }


        private async Task<IActionResult> GenerateCertificateAsync(List<string> altNames, string password)
        {

            var rootCert = CertUtil.LoadFromFileOrEncoded(appConfig.RootCertFile, true, appConfig.RootCertPassword);
            var intermediateCert = CertUtil.LoadFromFileOrEncoded(appConfig.IntermediateCertFile, true, appConfig.IntermediateCertPassword);

            if (rootCert == null)
            {
                return BadRequest("Could not load root certificate");
            }
            if (intermediateCert == null)
            {
                return BadRequest("Could not load intermediate certificate");
            }

            var x500Builder = new X500DistinguishedNameBuilder();
            x500Builder.AddCommonName(altNames[0]);
            x500Builder.AddOrganizationalUnitName("UDAP Testing");
            x500Builder.AddOrganizationName("FAST Security");
            x500Builder.AddLocalityName("Locality");
            x500Builder.AddStateOrProvinceName("State");
            x500Builder.AddCountryOrRegion("US");

            var distinguishedName = x500Builder.Build();

            var rsaCertificate = CertificateTooling.BuildUdapClientCertificate(
                intermediateCert,
                rootCert,
                new ClientCertificateOptions(
                    distinguishedName,
                    altNames,
                    CrlUrl: appConfig.IntermediateCrlUrl,
                    AiaCertUrl: appConfig.IntermediateCertUrl,
                    NotBefore: DateTimeOffset.UtcNow.AddDays(-1),
                    NotAfter: DateTimeOffset.UtcNow.AddYears(2),
                    Password: password));

            if (rsaCertificate is null)
            {
                return BadRequest("Could not generate certificate");
            }

            return File(rsaCertificate, "application/x-pkcs12", "client-cert.pfx");
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
