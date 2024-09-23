using Duende.IdentityServer;
using Duende.IdentityServer.EntityFramework.DbContexts;
using Duende.IdentityServer.EntityFramework.Mappers;
using Duende.IdentityServer.Models;
using Microsoft.EntityFrameworkCore;
using Serilog;
using System.Reflection;
using System.Security.Cryptography.X509Certificates;
using Udap.Common.Extensions;
using Udap.Model;
using Udap.Server.DbContexts;
using Udap.Server.Entities;
using Udap.Server.Models;
using Udap.Server.Storage.Stores;
using Udap.Util.Extensions;

namespace IdentityServer
{

    // seeding from https://github.com/udap-tools/udap-dotnet/blob/ada14f200032e84fd69e569801d8d66afe4266b5/migrations/UdapDb.SqlServer/SeedData.Auth.Server.cs

    public class SeedData
    {
        public static async Task InitializeDatabase(WebApplication app)
        {
            using (var scope = app.Services.GetRequiredService<IServiceScopeFactory>().CreateScope())
            {
                // ensure we have required services available before any seeding
                var persistedGrantContext = scope.ServiceProvider.GetRequiredService<PersistedGrantDbContext>();
                var configContext = scope.ServiceProvider.GetRequiredService<ConfigurationDbContext>();
                var udapContext = scope.ServiceProvider.GetRequiredService<UdapDbContext>();
                var clientRegistrationStore = scope.ServiceProvider.GetRequiredService<IUdapClientRegistrationStore>();

                // handle migrations
                await persistedGrantContext.Database.MigrateAsync();
                await configContext.Database.MigrateAsync();
                await udapContext.Database.MigrateAsync();

                // seed data
                await SeedIdentityResources(configContext);
                await SeedFhirScopes(configContext);
                await SeedCommunities(udapContext, clientRegistrationStore);
            }
        }


        private static async Task SeedIdentityResources(ConfigurationDbContext context)
        {
            Log.Debug("Seeding identity resources");

            //
            // openid
            //
            if (context.IdentityResources.All(i => i.Name != IdentityServerConstants.StandardScopes.OpenId))
            {
                var identityResource = new IdentityResources.OpenId();
                context.IdentityResources.Add(identityResource.ToEntity());

                await context.SaveChangesAsync();
            }

            //
            // fhirUser
            //
            if (context.IdentityResources.All(i => i.Name != UdapConstants.StandardScopes.FhirUser))
            {
                var fhirUserIdentity = new UdapIdentityResources.FhirUser();
                context.IdentityResources.Add(fhirUserIdentity.ToEntity());

                await context.SaveChangesAsync();
            }

            //
            // udap
            //
            if (context.ApiScopes.All(i => i.Name != UdapConstants.StandardScopes.Udap))
            {
                var udapIdentity = new UdapApiScopes.Udap();
                context.ApiScopes.Add(udapIdentity.ToEntity());

                await context.SaveChangesAsync();
            }

            //
            // profile
            //
            if (context.IdentityResources.All(i => i.Name != IdentityServerConstants.StandardScopes.Profile))
            {
                var identityResource = new UdapIdentityResources.Profile();
                context.IdentityResources.Add(identityResource.ToEntity());

                await context.SaveChangesAsync();
            }

            //
            // email
            //
            if (context.IdentityResources.All(i => i.Name != IdentityServerConstants.StandardScopes.Email))
            {
                var identityResource = new IdentityResources.Email();
                context.IdentityResources.Add(identityResource.ToEntity());

                await context.SaveChangesAsync();
            }
        }


        private static async Task SeedCommunities(UdapDbContext udapContext, IUdapClientRegistrationStore clientRegistrationStore)
        {

            Log.Debug("Seeding communities from CertStore");

            var assemblyPath = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            var communities = new List<Tuple<string, X509Certificate2>>();
            var certificateStorePath = "CertStore";
            var certificateStoreFullPath = Path.Combine(assemblyPath!, certificateStorePath);


            // Scan CertStore directory for communities
            foreach(var directory in Directory.GetDirectories(certificateStoreFullPath))
            {
                var dirName = new DirectoryInfo(directory).Name;
                var anchorFile = Directory.GetFiles(directory, "*.cer").Union(Directory.GetFiles(directory, "*.crt")).FirstOrDefault();
                if (anchorFile is null)
                {
                    Log.Warning($"Skipping {dirName} because no anchor certificate was found");
                    continue;
                }

                try
                {
                    var anchorCertificate = new X509Certificate2(anchorFile);
                    communities.Add(new Tuple<string, X509Certificate2>(dirName, anchorCertificate));
                }
                catch (Exception ex)
                {
                    Log.Error(ex, $"Failed to load anchor certificate for community {dirName}");
                }
            }

            // Add communities to the database
            foreach (var communityName in communities.Select(c => c.Item1))
            {
                if (!udapContext.Communities.Any(c => c.Name == communityName))
                {
                    Log.Debug($"Adding community {communityName} to the database");
                    udapContext.Communities.Add(new Community
                    {
                        Name = communityName,
                        Enabled = true,
                        Default = false
                    });
                    await udapContext.SaveChangesAsync();
                }
            }

            // Add anchors for communities
            foreach (var communitySeedData in communities)
            {
                var anchorCertificate = communitySeedData.Item2;
                var communityName = communitySeedData.Item1;

                // Add anchor for community if it doesn't already exist
                if ((await clientRegistrationStore.GetAnchors(communityName)).All(a => a.Thumbprint != anchorCertificate.Thumbprint))
                {
                    var community = await udapContext.Communities.FirstOrDefaultAsync(c => c.Name == communityName);
                    if (community is null)
                    {
                        Log.Error($"Failed to find community {communityName} in database while attempting to import anchor.");
                        continue;
                    }

                    var anchor = new Anchor
                    {
                        BeginDate = anchorCertificate.NotBefore.ToUniversalTime(),
                        EndDate = anchorCertificate.NotAfter.ToUniversalTime(),
                        Name = anchorCertificate.Subject,
                        Community = community,
                        X509Certificate = anchorCertificate.ToPemFormat(),
                        Thumbprint = anchorCertificate.Thumbprint,
                        Enabled = true
                    };

                    Log.Debug($"Adding anchor {anchor.Thumbprint} for community {community.Name} to the database");

                    udapContext.Anchors.Add(anchor);
                    await udapContext.SaveChangesAsync();
                }
            }


        }

        private static async Task SeedFhirScopes(ConfigurationDbContext configContext)
        {
            Log.Debug("Seeding FHIR scopes");

            // Seed initial FHIR scopes
            Func<string, bool> treatmentSpecification = r => r is "Patient" or "AllergyIntolerance" or "Condition" or "Encounter";
            var scopeProperties = new Dictionary<string, string> { { "smart_version", "v1" } };

            await SeedFhirScopes(configContext, Hl7ModelInfoExtensions.BuildHl7FhirV1Scopes("patient", treatmentSpecification), scopeProperties);
            await SeedFhirScopes(configContext, Hl7ModelInfoExtensions.BuildHl7FhirV1Scopes("user", treatmentSpecification), scopeProperties);
            await SeedFhirScopes(configContext, Hl7ModelInfoExtensions.BuildHl7FhirV1Scopes("system", treatmentSpecification), scopeProperties);

            scopeProperties = new Dictionary<string, string> { { "smart_version", "v2" } };
            await SeedFhirScopes(configContext, Hl7ModelInfoExtensions.BuildHl7FhirV2Scopes("patient", treatmentSpecification), scopeProperties);
            await SeedFhirScopes(configContext, Hl7ModelInfoExtensions.BuildHl7FhirV2Scopes("user", treatmentSpecification), scopeProperties);
            await SeedFhirScopes(configContext, Hl7ModelInfoExtensions.BuildHl7FhirV2Scopes("system", treatmentSpecification), scopeProperties);
        }


        private static async Task SeedFhirScopes(ConfigurationDbContext configDbContext, HashSet<string> seedScopes, Dictionary<string, string> scopeProperties)
        {

            var apiScopes = configDbContext.ApiScopes
                .Include(s => s.Properties)
                .Select(s => s)
                .ToList();

            foreach (var scopeName in seedScopes.Where(s => s.StartsWith("system")))
            {
                if (!apiScopes.Any(s =>
                        s.Name == scopeName && s.Properties.Exists(p => p.Key == "udap_prefix" && p.Value == "system")))
                {
                    var apiScope = new ApiScope(scopeName);
                    apiScope.ShowInDiscoveryDocument = false;

                    if (apiScope.Name.StartsWith("system/*."))
                    {
                        apiScope.ShowInDiscoveryDocument = true;
                        apiScope.Enabled = false;
                    }

                    apiScope.Properties.Add("udap_prefix", "system");

                    foreach (var scopeProperty in scopeProperties)
                    {
                        apiScope.Properties.Add(scopeProperty.Key, scopeProperty.Value);
                    }

                    configDbContext.ApiScopes.Add(apiScope.ToEntity());
                }
            }

            foreach (var scopeName in seedScopes.Where(s => s.StartsWith("user")))
            {
                if (!apiScopes.Any(s =>
                        s.Name == scopeName && s.Properties.Exists(p => p.Key == "udap_prefix" && p.Value == "user")))
                {
                    var apiScope = new ApiScope(scopeName);
                    apiScope.ShowInDiscoveryDocument = false;

                    if (apiScope.Name.StartsWith("patient/*."))
                    {
                        apiScope.ShowInDiscoveryDocument = true;
                        apiScope.Enabled = false;
                    }

                    apiScope.Properties.Add("udap_prefix", "user");

                    foreach (var scopeProperty in scopeProperties)
                    {
                        apiScope.Properties.Add(scopeProperty.Key, scopeProperty.Value);
                    }

                    configDbContext.ApiScopes.Add(apiScope.ToEntity());
                }
            }

            foreach (var scopeName in seedScopes.Where(s => s.StartsWith("patient")).ToList())
            {
                if (!apiScopes.Any(s => s.Name == scopeName && s.Properties.Exists(p => p.Key == "udap_prefix" && p.Value == "patient")))
                {
                    var apiScope = new ApiScope(scopeName);
                    apiScope.ShowInDiscoveryDocument = false;

                    if (apiScope.Name.StartsWith("patient/*."))
                    {
                        apiScope.ShowInDiscoveryDocument = true;
                        apiScope.Enabled = false;
                    }

                    apiScope.Properties.Add("udap_prefix", "patient");

                    foreach (var scopeProperty in scopeProperties)
                    {
                        apiScope.Properties.Add(scopeProperty.Key, scopeProperty.Value);
                    }

                    configDbContext.ApiScopes.Add(apiScope.ToEntity());
                }
            }

            await configDbContext.SaveChangesAsync();

        }
    }
}