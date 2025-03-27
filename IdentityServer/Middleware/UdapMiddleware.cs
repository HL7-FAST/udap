using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Duende.IdentityModel;
using Duende.IdentityServer.Stores;
using Udap.Model.Registration;
using Udap.Server.Validation;

namespace IdentityServer.Middleware
{

    public class UdapMiddleware(RequestDelegate next, ILogger<UdapMiddleware> logger, IResourceStore resourceStore, IScopeExpander scopeExpander)
    {
        public async Task Invoke(HttpContext context)
        {

            // check if this request will result in zero allowed scopes for a new client
            // if so... reject it before bothering to do any cert validation

            if (context.Request.Path.Value != null && context.Request.Path.Value.Contains("/connect/register"))
            {
                logger.LogDebug("Checking for allowed scopes for new client registration");
                context.Request.EnableBuffering();
                UdapRegisterRequest request;
                JwtSecurityToken jwt;
                try
                {
                    request = await context.Request.ReadFromJsonAsync<UdapRegisterRequest>() ?? throw new ArgumentNullException(nameof(context.Request));
                    var handler = new JwtSecurityTokenHandler();
                    jwt = handler.ReadToken(request.SoftwareStatement) as JwtSecurityToken;
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error reading request body");
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsJsonAsync(new UdapDynamicClientRegistrationErrorResponse
                    (
                        UdapDynamicClientRegistrationErrors.InvalidClientMetadata,
                        UdapDynamicClientRegistrationErrorDescriptions.MalformedMetaDataDocument
                    ));
            
                    return;
                }

                // Need at least one scope...
                var scopes = jwt.Claims.Where(c => c.Type == JwtClaimTypes.Scope).FirstOrDefault() ?? throw new ArgumentNullException(nameof(jwt.Claims));
                if (string.IsNullOrWhiteSpace(scopes.Value))
                {
                    logger.LogError("No scopes requested");

                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsJsonAsync(new UdapDynamicClientRegistrationErrorResponse
                    (
                        UdapDynamicClientRegistrationErrors.InvalidClientMetadata,
                        "No scopes requested"
                    ));
                    return;
                }

                var resources = await resourceStore.GetAllEnabledResourcesAsync();
                var expandedScopes = scopeExpander.Expand(scopes.Value.Split(" ")).ToList();
                var explodedScopes = scopeExpander.WildCardExpand(expandedScopes, resources.ApiScopes.Select(a => a.Name).ToList()).ToList();
                var allowedScopes = resources.ApiScopes.Where(s => explodedScopes.Contains(s.Name)).Select(s => s.Name).ToList()
                                        .Union(resources.IdentityResources.Where(s => explodedScopes.Contains(s.Name)).Select(s => s.Name).ToList());
                
                logger.LogDebug("Allowed Scopes: {Scopes}", allowedScopes);

                if (!allowedScopes.Any())
                {
                    logger.LogError("No allowed scopes for new client registration");

                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsJsonAsync(new UdapDynamicClientRegistrationErrorResponse
                    (
                        UdapDynamicClientRegistrationErrors.InvalidClientMetadata,
                        "invalid_scope"
                    ));
                    return;
                }

                context.Request.Body.Position = 0;
            }

            await next(context);
        }
        
    }


    // Extension method used to add the middleware to the HTTP request pipeline.
    public static class UdapExtensions
    {
        public static IApplicationBuilder UseCustomUdapMiddleware(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<UdapMiddleware>();
        }
    }
}
