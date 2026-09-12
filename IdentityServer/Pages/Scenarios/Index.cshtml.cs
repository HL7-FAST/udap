using System.ComponentModel.DataAnnotations;
using IdentityServer.Models;
using IdentityServer.Shared.x509;
using IdentityServer.Telemetry;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Serilog;

namespace IdentityServer.Pages.Scenarios;

[AllowAnonymous]
[SecurityHeaders(AllowDownloads = true)]
[EnableRateLimiting(CertGenerator.RateLimitPolicy)]
public class IndexModel(IOptions<AppConfig> appConfig, UdapMetrics metrics) : PageModel
{
    public IReadOnlyList<CertScenario> Scenarios => CertScenarioCatalog.All;

    // Each clause is quoted once below the table. Rows link to it by index.
    public List<SpecReference> References { get; } =
        CertScenarioCatalog.All.SelectMany(s => s.References).Append(CertScenarioCatalog.DcrErrorCodes).Distinct().ToList();

    public string ReferenceAnchor(SpecReference reference) => "ref-" + (References.IndexOf(reference) + 1);

    [BindProperty]
    public InputModel Input { get; set; } = new();

    public string? ErrorMessage { get; set; }

    public class InputModel
    {
        [Required]
        [StringLength(CertGenerator.MaxAltNames * (CertGenerator.MaxAltNameLength + 2))]
        public string AltNames { get; set; } = "http://localhost:8080/fhir";

        [Required]
        public string Password { get; set; } = "";

        [Required]
        public string Scenario { get; set; } = CertScenarioCatalog.Valid;

        public CertKeyType KeyType { get; set; } = CertKeyType.Rsa;
    }

    public void OnGet()
    {
        Input.Password = appConfig.Value.DefaultCertPassword;
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            return Page();
        }

        var scenario = CertScenarioCatalog.Find(Input.Scenario);
        if (scenario is null || !Enum.IsDefined(Input.KeyType))
        {
            ErrorMessage = "Pick a scenario and key type from the list.";
            return Page();
        }

        var altNames = CertGenerator.SplitAltNames(Input.AltNames);
        if (altNames.Count == 0 || altNames.Count > CertGenerator.MaxAltNames || altNames.Any(n => !CertGenerator.IsValidAltName(n)))
        {
            ModelState.AddModelError("Input.AltNames", $"Enter one absolute URI per line (at most {CertGenerator.MaxAltNames}), for example https://example.org/fhir");
            return Page();
        }

        try
        {
            // Resolved here so rendering the catalog never loads the local CA.
            var generator = HttpContext.RequestServices.GetRequiredService<CertGenerator>();
            var pfx = await generator.GenerateAsync(altNames, Input.Password, scenario, Input.KeyType, HttpContext.RequestAborted);
            metrics.RecordCertGeneration(true, CertGenerationProvider.Local.ToString(), scenario.Key);
            return File(pfx, "application/x-pkcs12", $"{scenario.Key}-client-cert.pfx");
        }
        catch (OperationCanceledException) when (HttpContext.RequestAborted.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Scenario certificate generation failed for {Scenario}", scenario.Key);
            metrics.RecordCertGeneration(false, CertGenerationProvider.Local.ToString(), scenario.Key);
            ErrorMessage = "Certificate generation failed. Check the server log for details.";
            return Page();
        }
    }
}
