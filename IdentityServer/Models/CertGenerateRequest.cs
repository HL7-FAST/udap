namespace IdentityServer.Models
{
    public class CertGenerateRequest
    {
        public List<string> AltNames { get; set; }
        public string Password { get; set; }
    }
}
