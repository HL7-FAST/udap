using System.Text.Json.Serialization;

namespace IdentityServer.Models
{

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum CertGenerationProvider
    {
        Local = 1,
        FhirLabs = 2
    }


    public class CertGenerateRequest
    {
        public List<string> AltNames { get; set; }
        public string Password { get; set; }
        public CertGenerationProvider Provider { get; set; }
    }
}
