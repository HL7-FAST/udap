namespace IdentityServer.Models
{
    public class AppConfig
    {
        public string SystemAdminPassword { get; set; } = "admin";
        public string UdapAdminPassword { get; set; } = "udap";
        public string UserPassword { get; set; } = "user";

        public bool SeedData { get; set; }
        public string UdapIdpBaseUrl { get; set; }

    }
}
