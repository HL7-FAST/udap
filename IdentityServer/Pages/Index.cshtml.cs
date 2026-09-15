using IdentityServer.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Options;
using System.Reflection;

namespace IdentityServer.Pages.Home
{
    [AllowAnonymous]
    public class Index(IOptions<AppConfig> appConfig) : PageModel
    {
        public string Version;
        public bool SandboxEnabled => appConfig.Value.SandboxEnabled;

        public void OnGet()
        {
            Version = typeof(Duende.IdentityServer.Hosting.IdentityServerMiddleware).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion.Split('+').First();
        }
    }
}
