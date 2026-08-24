using System.Text.Json;
using Duende.IdentityModel;

namespace IdentityServer.Middleware
{
    /// <summary>
    /// Rejects client_credentials token requests without a scope parameter, as required by
    /// the FAST Security IG (https://hl7.org/fhir/us/udap-security/STU2/b2b.html#client-credentials-grant).
    /// Without this check the UDAP library grants every allowed scope, which for an expanded
    /// wildcard registration produces an access token too large for most servers to accept.
    /// </summary>
    public class RequireScopeMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<RequireScopeMiddleware> _logger;

        public RequireScopeMiddleware(RequestDelegate next, ILogger<RequireScopeMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task Invoke(HttpContext context)
        {
            if (context.Request.Path.Value != null
                && context.Request.Path.Value.Contains("/connect/token")
                && context.Request.HasFormContentType)
            {
                var form = await context.Request.ReadFormAsync();
                var grantType = form[OidcConstants.TokenRequest.GrantType].FirstOrDefault();
                var scope = form[OidcConstants.TokenRequest.Scope].FirstOrDefault();

                if (grantType == OidcConstants.GrantTypes.ClientCredentials && string.IsNullOrWhiteSpace(scope))
                {
                    _logger.LogWarning("Rejecting client_credentials token request with no scope parameter");

                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        error = OidcConstants.TokenErrors.InvalidScope,
                        error_description = "The scope parameter is required for client_credentials token requests (HL7 UDAP Security IG, Section 5.2.2). Request the scopes granted at registration."
                    });
                    return;
                }
            }

            await _next(context);
        }
    }

    public static class RequireScopeMiddlewareExtensions
    {
        public static IApplicationBuilder UseRequireScope(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<RequireScopeMiddleware>();
        }
    }
}
