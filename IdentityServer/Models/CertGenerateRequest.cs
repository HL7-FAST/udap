using System.Text.Json.Serialization;

namespace IdentityServer.Models
{

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum CertGenerationProvider
    {
        Local = 1,
        FhirLabs = 2
    }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum CertKeyType
    {
        Rsa = 1,
        Ecdsa = 2
    }


    public class CertGenerateRequest
    {
        public List<string> AltNames { get; set; }
        public string Password { get; set; }
        public CertGenerationProvider Provider { get; set; }
        public string Scenario { get; set; } = "valid";
        public CertKeyType KeyType { get; set; } = CertKeyType.Rsa;
    }
}
