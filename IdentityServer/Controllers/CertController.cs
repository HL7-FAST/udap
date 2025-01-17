using IdentityServer.Models;
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

            string fhirLabsJitCertUrl = appConfig.FhirLabsJitCertUrl;
            string password = request.Password ?? appConfig.DefaultCertPassword;

            List<string> altNames = request.AltNames.Select(n => n.TrimEnd('/')).ToList();
             
            string queryString = string.Join("&", altNames.Select(n => $"subjAltNames={Uri.EscapeDataString(n)}"));
            queryString += $"&password={password}";
            string url = $"{fhirLabsJitCertUrl}?{queryString}";

            var response = await new HttpClient().GetAsync(url);
            Log.Information($"Response: {response.StatusCode}");

            var contentBase64 = await response.Content.ReadAsStringAsync();
            var bytes = Convert.FromBase64String(contentBase64);
            var certificate = X509CertificateLoader.LoadPkcs12(bytes, password, X509KeyStorageFlags.Exportable);

            var clientBytes = certificate.Export(X509ContentType.Pkcs12, password);

            return File(clientBytes, "application/x-pkcs12", "client-cert.pfx");
        }

    }
}
