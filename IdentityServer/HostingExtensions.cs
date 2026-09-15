using Duende.IdentityServer;
using Duende.IdentityServer.EntityFramework.Stores;
using Duende.IdentityServer.Test;
using Duende.IdentityModel;
using IdentityServer.Models;
using IdentityServer.Pages.Admin.ApiScopes;
using IdentityServer.Pages.Admin.Clients;
using IdentityServer.Pages.Admin.IdentityScopes;
using IdentityServer.Pages.Udap.Anchors;
using IdentityServer.Pages.Udap.Communities;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Serilog;
using System.Security.Claims;
using Microsoft.AspNetCore.DataProtection;
using Udap.Client.Configuration;
using Udap.Common;
using Udap.Common.Certificates;
using Udap.Server.Configuration;
using Udap.Server.Storage.DbContexts;
using Udap.Server.Security.Authentication.TieredOAuth;
using Udap.Server.Storage.Stores;
using IdentityServer.Middleware;
using IdentityServer.Revocation;
using IdentityServer.Sandbox;
using IdentityServer.Shared.x509;
using IdentityServer.Telemetry;
using Microsoft.AspNetCore.Authentication.OAuth;
using Microsoft.Extensions.Options;
using Yarp.ReverseProxy.Transforms;

namespace IdentityServer
{
    internal static class HostingExtensions
    {
        public static WebApplication ConfigureServices(this WebApplicationBuilder builder)
        {

            var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
            var provider = builder.Configuration.GetValue("provider", "no provider set");


            builder.Services.AddOptions();
            builder.Services.AddMemoryCache();
            builder.Services.AddHttpContextAccessor();
            builder.Services.AddRazorPages();

            builder.Services.Configure<AppConfig>(builder.Configuration.GetRequiredSection(nameof(AppConfig)));
            var appConfig = builder.Configuration.GetOption<AppConfig>(nameof(AppConfig));

            builder.WebHost.ConfigureKestrel(options =>
            {
                options.Limits.MaxRequestLineSize = Math.Max(options.Limits.MaxRequestLineSize, appConfig.MaxScopeLength * 2);
            });


            builder.Services.AddUdapServer(
                    options =>
                    {
                        var udapServerOptions = builder.Configuration.GetOption<ServerSettings>("ServerSettings");
                        options.DefaultSystemScopes = udapServerOptions.DefaultSystemScopes;
                        options.DefaultUserScopes = udapServerOptions.DefaultUserScopes;
                        options.ForceStateParamOnAuthorizationCode = udapServerOptions.ForceStateParamOnAuthorizationCode;
                        options.RequireConsent = udapServerOptions.RequireConsent;
                        options.AllowRememberConsent = udapServerOptions.AllowRememberConsent;
                    },
                    storeOptionAction: options =>
                    _ = appConfig.DatabaseProvider switch
                    {
                        "Pgsql" => options.UdapDbContext = b =>
                            b.UseNpgsql(connectionString,
                                dbOpts => dbOpts.MigrationsAssembly("IdentityServer.Migrations.Pgsql")),
                        "SqlServer" => options.UdapDbContext = b =>
                            b.UseSqlServer(connectionString,
                                dbOpts => dbOpts.MigrationsAssembly("IdentityServer.Migrations.SqlServer")),
                        _ => options.UdapDbContext = b =>
                            b.UseSqlite(connectionString,
                                dbOpts => dbOpts.MigrationsAssembly("IdentityServer.Migrations.Sqlite"))
                    }
                        ,
                    baseUrl: appConfig.UdapIdpBaseUrl
                )
                .AddUdapResponseGenerators()
                .AddSmartV2Expander();

            // For development/testing, allow untrusted certs when calling out to other servers (e.g., for DCR)
            if (builder.Environment.IsDevelopment() || builder.Environment.IsEnvironment("Local"))
            {
                builder.Services.AddHttpClient<CertificateDownloadCache>()
                    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
                    {
                        ServerCertificateCustomValidationCallback =
                            HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
                    });
            }

            builder.Services.AddDataProtection().PersistKeysToDbContext<UdapDbContext>();

            builder.Services.Configure<UdapClientOptions>(builder.Configuration.GetSection("UdapClientOptions"));
            builder.Services.Configure<UdapFileCertStoreManifest>(builder.Configuration.GetSection(Udap.Common.Constants.UdapFileCertStoreManifestSectionName));

            builder.Services.AddSingleton<UdapMetrics>();

            builder.Services.AddSingleton(sp =>
            {
                var config = sp.GetRequiredService<IOptions<AppConfig>>().Value;
                var root = CertUtil.LoadFromFileOrEncoded(config.RootCertFile, true, config.RootCertPassword)
                    ?? throw new InvalidOperationException("AppConfig:RootCertFile could not be loaded");
                var intermediate = CertUtil.LoadFromFileOrEncoded(config.IntermediateCertFile, true, config.IntermediateCertPassword)
                    ?? throw new InvalidOperationException("AppConfig:IntermediateCertFile could not be loaded");
                return new CrlWriter(root, intermediate, CrlDirectory(sp));
            });
            builder.Services.AddSingleton(sp =>
            {
                var config = sp.GetRequiredService<IOptions<AppConfig>>().Value;
                return new RevocationStore(
                    CrlDirectory(sp),
                    sp.GetRequiredService<CrlWriter>(),
                    sp.GetService<ICertificateDownloadCache>(),
                    config.IntermediateCrlUrl);
            });
            builder.Services.AddHostedService<CrlMaintenanceService>();
            builder.Services.AddTransient<CertGenerator>();

            if (appConfig.SandboxEnabled)
            {
                builder.Services.AddHttpForwarder();
                builder.Services.AddHostedService<SandboxHostService>();
            }

            // Anonymous callers can mint certificates and, for the revoked scenario, grow the CRL; cap the rate.
            builder.Services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
                options.AddFixedWindowLimiter(CertGenerator.RateLimitPolicy, window =>
                {
                    window.Window = TimeSpan.FromMinutes(1);
                    window.PermitLimit = 30;
                    window.QueueLimit = 0;
                });
            });

            builder.Services.AddAuthentication()
                .AddTieredOAuth(options =>
                {
                    options.SignInScheme = IdentityServerConstants.ExternalCookieAuthenticationScheme;
                    options.Events.OnTicketReceived = ctx =>
                    {
                        ctx.HttpContext.RequestServices.GetRequiredService<UdapMetrics>().RecordTieredOAuth(success: true);
                        return Task.CompletedTask;
                    };
                    options.Events.OnRemoteFailure = ctx =>
                    {
                        ctx.HttpContext.RequestServices.GetRequiredService<UdapMetrics>().RecordTieredOAuth(success: false);
                        ctx.HttpContext.RequestServices.GetRequiredService<ILogger<TieredOAuthAuthenticationHandler>>()
                            .LogWarning(ctx.Failure, "Tiered OAuth sign-in failed for idp={Idp}", TieredIdp(ctx.Properties));
                        return Task.CompletedTask;
                    };
                });


            builder.Services.AddIdentityServer(options =>
                {
                    if (!string.IsNullOrEmpty(appConfig.IssuerUri))
                    {
                        options.IssuerUri = appConfig.IssuerUri;
                    }

                    options.Events.RaiseErrorEvents = true;
                    options.Events.RaiseInformationEvents = true;
                    options.Events.RaiseFailureEvents = true;
                    options.Events.RaiseSuccessEvents = true;

                    // see https://docs.duendesoftware.com/identityserver/v5/fundamentals/resources/
                    options.EmitStaticAudienceClaim = true;

                    //options.UserInteraction.LoginUrl = "/udapaccount/login";
                    //options.UserInteraction.LogoutUrl = "/udapaccount/logout";
                    options.InputLengthRestrictions.Scope = appConfig.MaxScopeLength;
                })
                .AddServerSideSessions()
                // this adds the config data from DB (clients, resources, CORS)
                .AddConfigurationStore(options =>
                    _ = appConfig.DatabaseProvider switch
                    {
                        "Pgsql" => options.ConfigureDbContext = b =>
                            b.UseNpgsql(connectionString,
                                dbOpts => dbOpts.MigrationsAssembly("IdentityServer.Migrations.Pgsql")),
                        "SqlServer" => options.ConfigureDbContext = b =>
                            b.UseSqlServer(connectionString,
                                dbOpts => dbOpts.MigrationsAssembly("IdentityServer.Migrations.SqlServer")),
                        _ => options.ConfigureDbContext = b =>
                            b.UseSqlite(connectionString,
                                dbOpts => dbOpts.MigrationsAssembly("IdentityServer.Migrations.Sqlite"))
                    })
                // this is something you will want in production to reduce load on and requests to the DB
                //.AddConfigurationStoreCache()
                //
                // this adds the operational data from DB (codes, tokens, consents)
                .AddOperationalStore(options =>
                    _ = appConfig.DatabaseProvider switch
                    {
                        "Pgsql" => options.ConfigureDbContext = b =>
                            b.UseNpgsql(connectionString,
                                dbOpts => dbOpts.MigrationsAssembly("IdentityServer.Migrations.Pgsql")),
                        "SqlServer" => options.ConfigureDbContext = b =>
                            b.UseSqlServer(connectionString,
                                dbOpts => dbOpts.MigrationsAssembly("IdentityServer.Migrations.SqlServer")),
                        _ => options.ConfigureDbContext = b =>
                            b.UseSqlite(connectionString,
                                dbOpts => dbOpts.MigrationsAssembly("IdentityServer.Migrations.Sqlite"))
                    })
                .AddResourceStore<ResourceStore>()
                .AddClientStore<ClientStore>()
                .AddTestUsers(new List<TestUser> { 
                    new TestUser()
                    {
                        SubjectId = "1",
                        Username = "admin",
                        Password = appConfig.SystemAdminPassword,
                        Claims = new List<Claim>()
                        {
                            new Claim(JwtClaimTypes.Name, "Admin Admin"),
                            new Claim(JwtClaimTypes.GivenName, "Admin")
                        }
                    },
                    new TestUser()
                    {
                        SubjectId = "2",
                        Username = "udap",
                        Password = appConfig.UdapAdminPassword,
                        Claims = new List<Claim>()
                        {
                            new Claim(JwtClaimTypes.Name, "UDAP Admin"),
                            new Claim(JwtClaimTypes.GivenName, "UDAP")
                        }
                    },
                    new TestUser()
                    {
                        SubjectId = "3",
                        Username = "user",
                        Password = appConfig.UserPassword,
                        Claims = new List<Claim>()
                        {
                            new Claim(JwtClaimTypes.Name, "Test User"),
                            new Claim(JwtClaimTypes.GivenName, "User")
                        }
                    }
                });
            
            // this adds the necessary config for the simple admin/config pages
            {
                builder.Services.AddAuthorization(options => {
                    options.AddPolicy("system-admin", policy => policy.RequireClaim("sub", "1"));
                    options.AddPolicy("udap-admin", policy => policy.RequireClaim("sub", "1", "2"));
                });

                builder.Services.Configure<RazorPagesOptions>(options => {
                    options.Conventions.AuthorizeFolder("/Admin", "system-admin");
                    options.Conventions.AuthorizeFolder("/Udap", "udap-admin");
                });

                builder.Services.AddTransient<IdentityServer.Pages.Portal.ClientRepository>();
                builder.Services.AddTransient<ClientRepository>();
                builder.Services.AddTransient<IdentityScopeRepository>();
                builder.Services.AddTransient<ApiScopeRepository>();

                // UDAP admin page repositories
                builder.Services.AddTransient<AnchorRepository>();
                builder.Services.AddTransient<CommunityRepository>();
            }

            // if you want to use server-side sessions: https://blog.duendesoftware.com/posts/20220406_session_management/
            // then enable it
            //isBuilder.AddServerSideSessions();
            //
            // and put some authorization on the admin/management pages using the same policy created above
            //builder.Services.Configure<RazorPagesOptions>(options =>
            //    options.Conventions.AuthorizeFolder("/ServerSideSessions", "admin"));

            builder.Services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor
                    | ForwardedHeaders.XForwardedProto
                    | ForwardedHeaders.XForwardedHost;
                options.KnownNetworks.Clear();
                options.KnownProxies.Clear();
            });

            builder.Services.AddControllers();
            builder.Services.AddDirectoryBrowser();
            builder.Services.AddHealthChecks();

            builder.Services.AddMvcCore().AddApiExplorer();
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();

            return builder.Build();
        }


        /// <summary>The IdP the user chose, carried in the returnUrl of the external sign-in.</summary>
        private static string? TieredIdp(Microsoft.AspNetCore.Authentication.AuthenticationProperties? properties)
        {
            if (properties == null || !properties.Items.TryGetValue("returnUrl", out var returnUrl) || returnUrl == null)
            {
                return null;
            }
            return System.Web.HttpUtility.ParseQueryString(returnUrl).GetValues("idp")?.LastOrDefault();
        }

        // Derived from IntermediateCrlUrl so the CDP in issued certificates and the file on disk cannot disagree.
        // The file server serves CertStore under the content root, not the bin copy SeedData reads anchors from.
        private static string CrlDirectory(IServiceProvider sp)
        {
            var url = sp.GetRequiredService<IOptions<AppConfig>>().Value.IntermediateCrlUrl;
            var segments = new Uri(url).AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
            var certs = Array.IndexOf(segments, "certs");
            if (certs < 0 || certs >= segments.Length - 2)
            {
                throw new InvalidOperationException($"AppConfig:IntermediateCrlUrl must point under /certs/<community>/..., got {url}");
            }
            var relative = Path.Combine(segments[(certs + 1)..^1]);
            return Path.Combine(sp.GetRequiredService<IWebHostEnvironment>().ContentRootPath, "CertStore", relative);
        }

        public static WebApplication ConfigurePipeline(this WebApplication app)
        {
            var appConfig = app.Configuration.GetOption<AppConfig>(nameof(AppConfig));

            if (!string.IsNullOrEmpty(appConfig.PathBase))
            {
                app.UsePathBase(appConfig.PathBase);
            }

            app.UseForwardedHeaders();
            app.UseSerilogRequestLogging();

            if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Local"))
            {
                app.UseDeveloperExceptionPage();
            }

            app.MapControllers();

            app.UseSwagger();
            app.UseSwaggerUI();

            app.UseWhen(
                context => !context.Request.Path.StartsWithSegments("/certs"),
                appBuilder => appBuilder.UseHttpsRedirection()
            );
            app.UseRouting();
            app.UseRateLimiter();


            app.UseDefaultFiles();
            app.UseStaticFiles();
            app.UseFileServer(new FileServerOptions 
            {
                FileProvider = new PhysicalFileProvider(Path.Combine(app.Environment.ContentRootPath, "CertStore")),
                RequestPath = "/certs",
                EnableDirectoryBrowsing = true
            });

            app.UseCors(builder => builder.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());

            // must run before the UDAP scope enrichment middleware fills in a missing scope
            app.UseRequireScope();
            app.UseIdentityServer();
            app.UseUdapServer();

            // middleware to handle customizations over the base UDAP libraries
            app.UseCustomUdapMiddleware();


            app.UseAuthorization();
            app.MapRazorPages().RequireAuthorization();

            app.MapHealthChecks("/health");

            if (appConfig.SandboxEnabled)
            {
                // The build inlines the full external path, so the path base stripped by UsePathBase goes back on before forwarding.
                app.MapForwarder(SandboxHostService.RoutePrefix + "/{**catch-all}", SandboxHostService.DestinationPrefix,
                    transforms => transforms.AddPathPrefix(appConfig.PathBase ?? ""));
            }

            return app;
        }
    }
}