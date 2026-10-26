namespace IdentityServer.Telemetry;

/// <summary>
/// Bounded http.route values for requests that no endpoint handles. Duende IdentityServer and the UDAP
/// server answer from middleware, so ASP.NET Core records no route for them and the fleet dashboard
/// cannot tell a token request from a scanner probe. The protocol paths come from Duende's endpoint
/// registry, which Udap.Server also registers into, so a library upgrade needs no change here. The
/// UDAP metadata pages are served by a middleware with no registry and are listed by hand. The
/// request path itself never becomes a route.
/// </summary>
public class RouteTemplates
{
    public const string Unhandled = "/unhandled";
    public const string Static = "/static/{file}";
    public const string Certs = "/certs/{file}";

    private static readonly string[] MiddlewarePaths =
    {
        "/",
        "/.well-known/udap",
        "/.well-known/udap/communities",
        "/.well-known/udap/communities/ashtml",
    };

    private readonly HashSet<string> _knownPaths;

    public RouteTemplates(IEnumerable<string> registeredEndpointPaths)
    {
        _knownPaths = new HashSet<string>(MiddlewarePaths, StringComparer.OrdinalIgnoreCase);
        foreach (var path in registeredEndpointPaths)
        {
            _knownPaths.Add(Normalize(path));
        }
    }

    /// <summary>
    /// Returns the route for a request, or null when an endpoint owns the request and ASP.NET Core
    /// records the route itself.
    /// </summary>
    public string? Resolve(string? path, bool hasEndpoint)
    {
        if (hasEndpoint)
        {
            return null;
        }
        var normalized = Normalize(path);
        if (_knownPaths.Contains(normalized))
        {
            return normalized.ToLowerInvariant();
        }
        if (normalized.StartsWith("/certs/", StringComparison.OrdinalIgnoreCase))
        {
            return Certs;
        }
        if (Path.HasExtension(normalized))
        {
            return Static;
        }
        return Unhandled;
    }

    private static string Normalize(string? path)
    {
        var trimmed = (path ?? "").TrimEnd('/');
        if (trimmed.Length == 0)
        {
            return "/";
        }
        return trimmed.StartsWith('/') ? trimmed : "/" + trimmed;
    }
}
