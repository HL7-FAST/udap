using System.Security.Cryptography.X509Certificates;
using IdentityServer.Models;
using IdentityServer.Revocation;
using IdentityServer.Shared.x509;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Options;
using Serilog;

namespace IdentityServer.Pages.Udap.Revocations;

[SecurityHeaders]
[Authorize]
[RequestSizeLimit(256 * 1024)]
[RequestFormLimits(MultipartBodyLengthLimit = 128 * 1024)]
public class IndexModel(RevocationStore store, IOptions<AppConfig> appConfig) : PageModel
{
    public static readonly IReadOnlyList<X509RevocationReason> Reasons =
    [
        X509RevocationReason.Unspecified,
        X509RevocationReason.KeyCompromise,
        X509RevocationReason.CessationOfOperation,
        X509RevocationReason.Superseded,
    ];

    public IReadOnlyList<RevokedEntry> Entries { get; private set; } = [];
    public string CrlUrl => appConfig.Value.IntermediateCrlUrl;

    [BindProperty]
    public IFormFile? CertificateFile { get; set; }

    [BindProperty]
    public string? FilePassword { get; set; }

    [BindProperty]
    public string? Serial { get; set; }

    [BindProperty]
    public X509RevocationReason Reason { get; set; } = X509RevocationReason.Unspecified;

    public string? ErrorMessage { get; set; }

    [TempData]
    public string? SuccessMessage { get; set; }

    public void OnGet()
    {
        Entries = store.GetAll().OrderByDescending(e => e.RevokedAt).ToList();
    }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
        {
            OnGet();
            return Page();
        }

        string serial;
        string subject;

        if (CertificateFile is { Length: > 0 })
        {
            if (CertificateFile.Length > 64 * 1024)
            {
                return Failed("Certificate file is too large; a certificate or bundle is a few kilobytes.");
            }

            try
            {
                using var stream = new MemoryStream();
                await CertificateFile.CopyToAsync(stream, HttpContext.RequestAborted);
                (serial, subject) = CertificateFileParser.Parse(stream.ToArray(), FilePassword ?? appConfig.Value.DefaultCertPassword);
            }
            catch (OperationCanceledException) when (HttpContext.RequestAborted.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                return Failed($"Could not read the certificate file: {ex.Message}");
            }
        }
        else if (!string.IsNullOrWhiteSpace(Serial))
        {
            serial = Serial.Replace(":", "").Replace(" ", "").ToUpperInvariant();
            if (serial.Length == 0 || serial.Length % 2 != 0 || !serial.All(Uri.IsHexDigit))
            {
                return Failed("Serial number must be hex digits, optionally separated by colons.");
            }
            subject = "(serial number entered by hand)";
        }
        else
        {
            return Failed("Upload a certificate or enter a serial number.");
        }

        if (!Reasons.Contains(Reason))
        {
            return Failed("Pick a revocation reason from the list.");
        }

        try
        {
            await store.RevokeAsync(serial, subject, Reason, HttpContext.RequestAborted);
        }
        catch (OperationCanceledException) when (HttpContext.RequestAborted.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Revocation of {Serial} failed", serial);
            return Failed($"Revocation failed: {ex.Message}");
        }

        Log.Information("Certificate {Serial} revoked from the admin page", serial);
        SuccessMessage = $"Revoked {serial}. The CRL at {CrlUrl} has been rewritten.";
        return RedirectToPage();
    }

    private PageResult Failed(string message)
    {
        ErrorMessage = message;
        OnGet();
        return Page();
    }
}
