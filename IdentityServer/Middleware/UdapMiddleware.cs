using System.Diagnostics;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using Duende.IdentityModel;
using Duende.IdentityServer.Stores;
using IdentityServer.Telemetry;
using Udap.Model.Registration;
using Udap.Server.Validation;

namespace IdentityServer.Middleware
{
    /// <summary>
    /// Wraps /connect/register: rejects registrations that request no allowed scopes before the
    /// library sees them, then records the final outcome as a metric and one structured log event.
    /// The log event carries the certificate subject and issuer, which is the only identity that
    /// survives a redeploy (client ids are minted fresh each time).
    /// </summary>
    public class UdapMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<UdapMiddleware> _logger;
        private readonly UdapMetrics _metrics;

        public UdapMiddleware(RequestDelegate next, ILogger<UdapMiddleware> logger, UdapMetrics metrics)
        {
            _next = next;
            _logger = logger;
            _metrics = metrics;
        }

        public async Task Invoke(HttpContext context, IResourceStore resourceStore, IScopeExpander scopeExpander)
        {
            if (context.Request.Path.Value == null || !context.Request.Path.Value.Contains("/connect/register"))
            {
                await _next(context);
                return;
            }

            _logger.LogDebug("Checking for allowed scopes for new client registration");
            context.Request.EnableBuffering();
            UdapRegisterRequest request;
            JwtSecurityToken jwt;
            try
            {
                request = await context.Request.ReadFromJsonAsync<UdapRegisterRequest>() ?? throw new ArgumentNullException(nameof(context.Request));
                var handler = new JwtSecurityTokenHandler();
                jwt = handler.ReadToken(request.SoftwareStatement) as JwtSecurityToken ?? throw new ArgumentException("Software statement is not a JWT");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reading request body");
                await RejectAsync(context, UdapDynamicClientRegistrationErrorDescriptions.MalformedMetaDataDocument, UdapMetrics.Error, jwt: null);
                return;
            }

            // Need at least one scope...
            var scopes = jwt.Claims.Where(c => c.Type == JwtClaimTypes.Scope).FirstOrDefault() ?? throw new ArgumentNullException(nameof(jwt.Claims));
            if (string.IsNullOrWhiteSpace(scopes.Value))
            {
                _logger.LogError("No scopes requested");
                await RejectAsync(context, "No scopes requested", UdapMetrics.ScopeRejected, jwt);
                return;
            }

            var resources = await resourceStore.GetAllEnabledResourcesAsync(context.RequestAborted);
            var expandedScopes = scopeExpander.Expand(scopes.Value.Split(" ")).ToList();
            var explodedScopes = scopeExpander.WildCardExpand(expandedScopes, resources.ApiScopes.Select(a => a.Name).ToList()).ToList();
            var allowedScopes = resources.ApiScopes.Where(s => explodedScopes.Contains(s.Name)).Select(s => s.Name).ToList()
                                    .Union(resources.IdentityResources.Where(s => explodedScopes.Contains(s.Name)).Select(s => s.Name).ToList());

            _logger.LogDebug("Allowed Scopes: {Scopes}", allowedScopes);

            if (!allowedScopes.Any())
            {
                _logger.LogError("No allowed scopes for new client registration");
                await RejectAsync(context, "invalid_scope", UdapMetrics.ScopeRejected, jwt);
                return;
            }

            context.Request.Body.Position = 0;

            // The library writes the RFC 7591 error code into the response body only, so buffer
            // the body to read it back.
            var originalBody = context.Response.Body;
            using var buffer = new MemoryStream();
            context.Response.Body = buffer;
            try
            {
                await _next(context);
            }
            finally
            {
                context.Response.Body = originalBody;
                buffer.Position = 0;
                await buffer.CopyToAsync(originalBody, context.RequestAborted);
            }

            var succeeded = context.Response.StatusCode is StatusCodes.Status200OK or StatusCodes.Status201Created;
            var error = succeeded ? null : ReadErrorCode(buffer);
            Record(succeeded ? UdapMetrics.Success : UdapMetrics.Error, error, jwt);
        }

        private async Task RejectAsync(HttpContext context, string description, string outcome, JwtSecurityToken? jwt)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new UdapDynamicClientRegistrationErrorResponse
            (
                UdapDynamicClientRegistrationErrors.InvalidClientMetadata,
                description
            ));
            Record(outcome, UdapDynamicClientRegistrationErrors.InvalidClientMetadata, jwt);
        }

        private void Record(string outcome, string? error, JwtSecurityToken? jwt)
        {
            var claims = jwt?.Claims ?? [];
            var grantTypes = claims.Where(c => c.Type == "grant_types").Select(c => c.Value).ToList();
            _metrics.RecordRegistration(outcome, error, grantTypes);

            var cert = ReadLeafCertificate(jwt);
            var clientName = claims.FirstOrDefault(c => c.Type == "client_name")?.Value;
            var issuer = claims.FirstOrDefault(c => c.Type == JwtClaimTypes.Issuer)?.Value;
            var scope = claims.FirstOrDefault(c => c.Type == JwtClaimTypes.Scope)?.Value;
            var redirectUris = claims.Where(c => c.Type == "redirect_uris").Select(c => c.Value).ToList();

            _logger.LogInformation(
                "UDAP registration {RegistrationOutcome} error={RegistrationError} client_name={ClientName} iss={SoftwareStatementIssuer} cert_subject={CertSubject} cert_issuer={CertIssuer} grant_types={GrantTypes} scope={RequestedScope}",
                outcome, error, clientName, issuer, cert?.Subject, cert?.Issuer, grantTypes, scope);

            // Request bodies are never captured by the HTTP instrumentation, so attach the decoded
            // software statement to the request span. The signature and certificate chain are omitted.
            Activity.Current?.AddEvent(new ActivityEvent("udap.software_statement", tags: new ActivityTagsCollection
            {
                { "udap.outcome", outcome },
                { "udap.error", error },
                { "udap.client_name", clientName },
                { "udap.iss", issuer },
                { "udap.grant_types", string.Join(" ", grantTypes) },
                { "udap.scope", scope },
                { "udap.redirect_uris", string.Join(" ", redirectUris) },
                { "udap.cert_subject", cert?.Subject },
                { "udap.cert_issuer", cert?.Issuer }
            }));
        }

        private static string? ReadErrorCode(MemoryStream body)
        {
            try
            {
                body.Position = 0;
                using var doc = JsonDocument.Parse(body);
                return doc.RootElement.TryGetProperty("error", out var e) ? e.GetString() : null;
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static X509Certificate2? ReadLeafCertificate(JwtSecurityToken? jwt)
        {
            if (jwt == null || !jwt.Header.TryGetValue("x5c", out var x5c))
            {
                return null;
            }
            try
            {
                var first = x5c switch
                {
                    string s => s,
                    IEnumerable<object> list => list.FirstOrDefault()?.ToString(),
                    _ => x5c.ToString()
                };
                return first == null ? null : X509CertificateLoader.LoadCertificate(Convert.FromBase64String(first));
            }
            catch (Exception)
            {
                return null;
            }
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
