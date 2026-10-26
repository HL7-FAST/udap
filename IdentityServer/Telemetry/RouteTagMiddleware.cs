using System.Diagnostics;
using Microsoft.AspNetCore.Http.Features;

namespace IdentityServer.Telemetry;

/// <summary>
/// Gives middleware-served requests an http.route on the request metric and the server span. Runs
/// after routing so endpoint-routed requests (Razor pages, controllers, health) keep the route the
/// framework records. Both writes are no-ops when nothing listens.
/// </summary>
public class RouteTagMiddleware
{
    private readonly RequestDelegate _next;
    private readonly RouteTemplates _templates;

    public RouteTagMiddleware(RequestDelegate next, IEnumerable<Duende.IdentityServer.Hosting.Endpoint> endpoints)
    {
        _next = next;
        _templates = new RouteTemplates(endpoints.Select(endpoint => endpoint.Path.Value ?? ""));
    }

    public Task Invoke(HttpContext context)
    {
        var route = _templates.Resolve(context.Request.Path.Value, context.GetEndpoint() != null);
        if (route != null)
        {
            context.Features.Get<IHttpMetricsTagsFeature>()?.Tags.Add(new KeyValuePair<string, object?>("http.route", route));
            var activity = Activity.Current;
            if (activity != null)
            {
                activity.SetTag("http.route", route);
                activity.DisplayName = $"{context.Request.Method} {route}";
            }
        }
        return _next(context);
    }
}

public static class RouteTagExtensions
{
    public static IApplicationBuilder UseRouteTags(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<RouteTagMiddleware>();
    }
}
