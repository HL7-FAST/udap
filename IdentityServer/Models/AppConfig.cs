namespace IdentityServer.Models
{
    public class AppConfig
    {
        public string SystemAdminPassword { get; set; } = "admin";
        public string UdapAdminPassword { get; set; } = "udap";
        public string UserPassword { get; set; } = "user";

        public string DatabaseProvider { get; set; } = "Sqlite";
        public bool SeedData { get; set; }
        public string UdapIdpBaseUrl { get; set; }

        public string FhirLabsJitCertUrl { get; set; }
        public string DefaultCertPassword { get; set; } = "udap-test";

        public AnchorConfig[] Anchors { get; set; }
    }


    public class AnchorConfig
    {
        public string AnchorFile { get; set; }
        public string Community { get; set; }
    }
}
