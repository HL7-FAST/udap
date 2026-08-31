using Serilog.Debugging;

namespace IdentityServer.Telemetry;

/// <summary>
/// Reports the response body of a rejected OTLP log export to the Serilog SelfLog.
/// The sink itself only reports the status code, which leaves a 400 unexplained.
/// </summary>
public sealed class OtlpResponseLoggingHandler() : DelegatingHandler(new HttpClientHandler())
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var response = await base.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            SelfLog.WriteLine("OTLP log export rejected: {0} {1} {2}", (int)response.StatusCode, request.RequestUri, body);
        }
        return response;
    }
}
