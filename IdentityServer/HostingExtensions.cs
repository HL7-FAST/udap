using Duende.IdentityServer.EntityFramework.Stores;
using Duende.IdentityServer.Test;
using IdentityModel;
using IdentityServer.Models;
using IdentityServer.Pages.Admin.ApiScopes;
using IdentityServer.Pages.Admin.Clients;
using IdentityServer.Pages.Admin.IdentityScopes;
using IdentityServer.Pages.Udap.Anchors;
using IdentityServer.Pages.Udap.Communities;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Internal;
using Microsoft.Extensions.Configuration;
using Serilog;
using System.Security.Claims;
using Udap.Server.Configuration;

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

            builder.Services.AddUdapServer(
                    options =>
                    {
                        var udapServerOptions = builder.Configuration.GetOption<ServerSettings>("ServerSettings");
                        options.DefaultSystemScopes = udapServerOptions.DefaultSystemScopes;
                        options.DefaultUserScopes = udapServerOptions.DefaultUserScopes;
                        options.ServerSupport = udapServerOptions.ServerSupport;
                        options.ForceStateParamOnAuthorizationCode = udapServerOptions.ForceStateParamOnAuthorizationCode;
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



            builder.Services.AddIdentityServer(options =>
                {
                    options.Events.RaiseErrorEvents = true;
                    options.Events.RaiseInformationEvents = true;
                    options.Events.RaiseFailureEvents = true;
                    options.Events.RaiseSuccessEvents = true;

                    // see https://docs.duendesoftware.com/identityserver/v5/fundamentals/resources/
                    options.EmitStaticAudienceClaim = true;
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


            builder.Services.AddHealthChecks();

            Console.WriteLine($"typeof(Program).Assembly.FullName): {typeof(Program).Assembly.FullName}");

            return builder.Build();
        }


        public static WebApplication ConfigurePipeline(this WebApplication app)
        {
            app.UseSerilogRequestLogging();

            if (app.Environment.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            app.UseHttpsRedirection();
            app.UseStaticFiles();
            app.UseRouting();
                        
            app.UseIdentityServer();
            app.UseUdapServer();

            app.UseAuthorization();
            app.MapRazorPages().RequireAuthorization();

            app.MapHealthChecks("/health");

            return app;
        }
    }
}