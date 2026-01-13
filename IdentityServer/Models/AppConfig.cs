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
        public string PathBase { get; set; }
        public string IssuerUri { get; set; }

        public string FhirLabsJitCertUrl { get; set; }
        public string DefaultCertPassword { get; set; } = "udap-test";

        public string RootCertFile { get; set; }
        public string RootCertPassword { get; set; } = "udap-test";
        public string IntermediateCertFile { get; set; }
        public string IntermediateCertPassword { get; set; } = "udap-test";

        public string IntermediateCrlUrl { get; set; }
        public string IntermediateCertUrl { get; set; }


        public AnchorConfig[] Anchors { get; set; }
    }


    public class AnchorConfig
    {
        public string AnchorFile { get; set; }
        public string Community { get; set; }
    }
}
