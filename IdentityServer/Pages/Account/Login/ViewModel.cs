// Copyright (c) Duende Software. All rights reserved.
// See LICENSE in the project root for license information.

using Udap.Server.Security.Authentication.TieredOAuth;

namespace IdentityServer.Pages.Login
{
    public class ViewModel
    {
        public bool AllowRememberLogin { get; set; } = true;
        public bool EnableLocalLogin { get; set; } = true;

        public IEnumerable<ExternalProvider> ExternalProviders { get; set; } = Enumerable.Empty<ExternalProvider>();
        public IEnumerable<ExternalProvider> VisibleExternalProviders => 
            ExternalProviders.Where(x => 
                !string.IsNullOrWhiteSpace(x.DisplayName) &&
                x.AuthenticationScheme != TieredOAuthAuthenticationDefaults.AuthenticationScheme);

        public ExternalProvider TieredProvider =>
            ExternalProviders.SingleOrDefault(p =>
                !string.IsNullOrEmpty(p.TieredOAuthIdp) &&
                p.AuthenticationScheme == TieredOAuthAuthenticationDefaults.AuthenticationScheme);

        public bool IsExternalLoginOnly => EnableLocalLogin == false && ExternalProviders?.Count() == 1;
        public string ExternalLoginScheme => IsExternalLoginOnly ? ExternalProviders?.SingleOrDefault()?.AuthenticationScheme : null;

        public class ExternalProvider
        {
            public string DisplayName { get; set; }
            public string AuthenticationScheme { get; set; }
            public string? ReturnUrl { get; set; }
            public string? TieredOAuthIdp { get; set; }
        }
    }
}