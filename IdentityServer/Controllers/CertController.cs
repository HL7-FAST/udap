using IdentityServer.Models;
using IdentityServer.Shared.x509;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Serilog;
using System.Formats.Asn1;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;

namespace IdentityServer.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CertController : ControllerBase
    {

        private readonly AppConfig appConfig;
        private readonly HttpContext httpContext;

        public CertController(IOptions<AppConfig> appConfig, IHttpContextAccessor httpContextAccessor)
        {
            this.appConfig = appConfig.Value;
            httpContext = httpContextAccessor.HttpContext;
        }


        [HttpPost("generate")]
        public async Task<IActionResult> Generate(CertGenerateRequest request)
        {

            if (request.AltNames == null || request.AltNames.Count < 1)
            {
                return BadRequest("At least one altNames parameter is required");
            }

            Log.Information($"Generating certificate for altNames: {string.Join(", ", request.AltNames)}");
            string password = request.Password ?? appConfig.DefaultCertPassword;
            request.Provider = request.Provider == 0 ? CertGenerationProvider.Local : request.Provider;

            if (request.Provider == CertGenerationProvider.FhirLabs)
            {
                return await ProxyToFhirLabs(request.AltNames, password);
            }

            return await GenerateCertificateAsync(request.AltNames, password);
        }


        public async Task<IActionResult> GenerateCertificateAsync(List<string> altNames, string password)
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
            x500Builder.AddCommonName(altNames.First());
            x500Builder.AddOrganizationalUnitName("UDAP Testing");
            x500Builder.AddOrganizationName("FAST Security");
            x500Builder.AddLocalityName("Locality");
            x500Builder.AddStateOrProvinceName("State");
            x500Builder.AddCountryOrRegion("US");

            var distinguishedName = x500Builder.Build();

            var certTooling = new CertificateTooling();


            var rsaCertificate = certTooling.BuildUdapClientCertificate(
                intermediateCert,
                rootCert,
                intermediateCert.GetRSAPrivateKey()!,
                distinguishedName,
                altNames,
                appConfig.IntermediateCrlUrl,
                appConfig.IntermediateCertUrl,
                DateTimeOffset.UtcNow.AddDays(-1),
                DateTimeOffset.UtcNow.AddYears(2),
                password
            );

            return File(rsaCertificate, "application/x-pkcs12", "client-cert.pfx");
        }


        public async Task<IActionResult> ProxyToFhirLabs(List<string> altNames, string password)
        {

            Log.Information($"Proxy request to FhirLabs for altNames: {string.Join(", ", altNames)}");

            string fhirLabsJitCertUrl = appConfig.FhirLabsJitCertUrl;

            string queryString = string.Join("&", altNames.Select(n => $"subjAltNames={Uri.EscapeDataString(n)}"));
            queryString += $"&password={password}";
            string url = $"{fhirLabsJitCertUrl}?{queryString}";

            var response = await new HttpClient().GetAsync(url);
            Log.Information($"Response: {response.StatusCode}");

            var contentBase64 = await response.Content.ReadAsStringAsync();
            var bytes = Convert.FromBase64String(contentBase64);

            return File(bytes, "application/x-pkcs12", "client-cert.pfx");

        }
    }
}
