﻿using Duende.IdentityServer;
using Duende.IdentityServer.EntityFramework.DbContexts;
using Duende.IdentityServer.EntityFramework.Mappers;
using Duende.IdentityServer.Models;
using IdentityServer.Models;
using IdentityServer.Shared.x509;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Serilog;
using System.Reflection;
using System.Security.Cryptography.X509Certificates;
using Udap.Common.Extensions;
using Udap.Model;
using Udap.Server.Configuration;
using Udap.Server.DbContexts;
using Udap.Server.Entities;
using Udap.Server.Models;
using Udap.Server.Storage.Stores;
using Udap.Util.Extensions;

namespace IdentityServer
{

    // seeding from https://github.com/udap-tools/udap-dotnet/blob/ada14f200032e84fd69e569801d8d66afe4266b5/migrations/UdapDb.SqlServer/SeedData.Auth.Server.cs

    public class SeedData()
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
                var appConfig = app.Configuration.GetOption<AppConfig>(nameof(AppConfig));

                // handle migrations
                await persistedGrantContext.Database.MigrateAsync();
                await configContext.Database.MigrateAsync();
                await udapContext.Database.MigrateAsync();

                // seed data
                await SeedIdentityResources(configContext);
                await SeedFhirScopes(configContext);
                await SeedCommunities(udapContext, clientRegistrationStore, appConfig);
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


        private static async Task SeedCommunities(UdapDbContext udapContext, IUdapClientRegistrationStore clientRegistrationStore, AppConfig appConfig)
        {

            Log.Debug("Seeding communities from CertStore");

            var assemblyPath = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            var communities = new List<Tuple<string, X509Certificate2>>();
            var certificateStorePath = "CertStore";
            var certificateStoreFullPath = Path.Combine(assemblyPath!, certificateStorePath);
            var intermediatesToLoad = new List<X509Certificate2>();


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
                    var anchorCertificate = X509CertificateLoader.LoadCertificateFromFile(anchorFile);
                    communities.Add(new Tuple<string, X509Certificate2>(dirName, anchorCertificate));
                }
                catch (Exception ex)
                {
                    Log.Error(ex, $"Failed to load anchor certificate for community {dirName}");
                }

                // load any intermediates
                if (!Directory.Exists(directory + "/intermediates"))
                {
                    Log.Debug($"No intermediates found for {dirName}");
                    continue;
                }
                var intermediates = Directory.GetFiles(directory + "/intermediates", "*.cer").Union(Directory.GetFiles(directory + "/intermediates", "*.crt"));
                Log.Information($"Found {intermediates.Count()} intermediate certificates in {dirName}");
                foreach (var intermediateFile in intermediates)
                {
                    try
                    {
                        var intermediateCertificate = X509CertificateLoader.LoadCertificateFromFile(intermediateFile);
                        if (intermediateCertificate is null)
                        {
                            Log.Warning($"Could not load intermediate certificate from {intermediateFile}");
                            continue;
                        }
                        intermediatesToLoad.Add(intermediateCertificate);
                    }
                    catch (Exception ex)
                    {
                        Log.Error(ex, $"Failed to load intermediate certificate for community {dirName}");
                    }
                }

            }

            // Check for additional anchors from configuration
            if (appConfig.Anchors is not null)
            {
                Log.Debug("Seeding anchors from app config");

                foreach (var anchorConfig in appConfig.Anchors)
                {
                    var cert = CertUtil.LoadFromFileOrEncoded(anchorConfig.AnchorFile);
                    if (cert is null)
                    {
                        Log.Warning($"Could not load certificate from {anchorConfig.AnchorFile}");
                        continue;
                    }
                    communities.Add(new Tuple<string, X509Certificate2>(anchorConfig.Community, cert));
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

            // Add any intermediates found
            if (intermediatesToLoad.Count > 0)
            {
                
                foreach (var cert in intermediatesToLoad)
                {
                    var anchor = await udapContext.Anchors.Where(a => a.Name == cert.Issuer).FirstOrDefaultAsync();
                    if (anchor is null)
                    {
                        Log.Error($"Failed to find anchor for intermediate certificate {cert.Subject} in database while attempting to import intermediate.");
                        continue;
                    }

                    var intermediate = new Intermediate
                    {
                        BeginDate = cert.NotBefore.ToUniversalTime(),
                        EndDate = cert.NotAfter.ToUniversalTime(),
                        Name = cert.Subject,
                        X509Certificate = cert.ToPemFormat(),
                        Thumbprint = cert.Thumbprint,
                        Enabled = true,
                        Anchor = anchor,
                    };

                    udapContext.IntermediateCertificates.Add(intermediate);
                }
                await udapContext.SaveChangesAsync();

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