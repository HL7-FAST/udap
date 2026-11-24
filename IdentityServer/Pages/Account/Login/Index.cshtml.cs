using Duende.IdentityServer;
using Duende.IdentityServer.Events;
using Duende.IdentityServer.Models;
using Duende.IdentityServer.Services;
using Duende.IdentityServer.Stores;
using Duende.IdentityServer.Test;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.WebUtilities;
using System.Web;

namespace IdentityServer.Pages.Login
{
    [SecurityHeaders]
    [AllowAnonymous]
    public class Index : PageModel
    {
        private readonly TestUserStore _users;
        private readonly IIdentityServerInteractionService _interaction;
        private readonly IEventService _events;
        private readonly IAuthenticationSchemeProvider _schemeProvider;
        private readonly IIdentityProviderStore _identityProviderStore;

        public ViewModel View { get; set; }

        [BindProperty]
        public InputModel Input { get; set; }

        [BindProperty]
        public PersonaInputModel? Persona { get; set; }

        // The section "Sign in as a FHIR resource" reads these values of the authorize request.
        public bool PersonaTiered { get; private set; }
        public bool PersonaBaseFixed { get; private set; }
        public bool PersonaNeedsPatient { get; private set; }
        public string? PersonaMessage { get; private set; }

        private AuthorizationRequest? _context;

        public Index(
            IIdentityServerInteractionService interaction,
            IAuthenticationSchemeProvider schemeProvider,
            IIdentityProviderStore identityProviderStore,
            IEventService events,
            TestUserStore users = null)
        {
            // this is where you would plug in your own custom identity management library (e.g. ASP.NET Identity)
            _users = users ?? throw new Exception("Please call 'AddTestUsers(TestUsers.Users)' on the IIdentityServerBuilder in Startup or remove the TestUserStore from the AccountController.");

            _interaction = interaction;
            _schemeProvider = schemeProvider;
            _identityProviderStore = identityProviderStore;
            _events = events;
        }

        public async Task<IActionResult> OnGet(string? returnUrl)
        {
            await BuildModelAsync(returnUrl);

            if (View.IsExternalLoginOnly)
            {
                // we only have one option for logging in and it's an external provider
                return RedirectToPage("/ExternalLogin/Challenge", new { scheme = View.ExternalLoginScheme, returnUrl });
            }

            if (View.TieredProvider != null)
            {
                return RedirectToPage("/UdapTieredLogin/Challenge",
                    new { scheme = View.TieredProvider.AuthenticationScheme, returnUrl });
            }

            var (aud, loginHint, signIn, scopes) = PersonaRequest(_context);
            if (View.EnableLocalLogin)
            {
                var refusal = FhirPersona.AutoSignInRefusalFor(User, aud, loginHint, signIn, scopes, _context?.IdP);
                if (refusal == AutoSignInRefusal.None && FhirPersona.TryParseHint(loginHint, out var type, out var id))
                {
                    await SignInAsResourceAsync(FhirPersona.CreateUser(aud!, type, id, null));
                    return _context!.IsNativeClient() ? this.LoadingPage(returnUrl!) : Redirect(returnUrl!);
                }

                // The switch names each value and has no default arm, so a value with no arm gives the warning CS8509. CS8524 is off because FhirPersona returns no unnamed value.
#pragma warning disable CS8524
                PersonaMessage = refusal switch
                {
                    AutoSignInRefusal.None or AutoSignInRefusal.NotRequested or AutoSignInRefusal.Tiered => null,
                    AutoSignInRefusal.IdentityProvider => "No automatic sign-in: the request names an identity provider in acr_values.",
                    AutoSignInRefusal.NoBase => "No automatic sign-in: the request has no aud parameter with a valid FHIR base URL.",
                    AutoSignInRefusal.NoResourceHint => $"No automatic sign-in: the request has no login_hint of the form Type/id with a type of {string.Join(", ", FhirPersona.ResourceTypes)}.",
                    AutoSignInRefusal.OtherSession => "No automatic sign-in: you are signed in with an account that is not a FHIR resource.",
                    AutoSignInRefusal.NoPatient => "No automatic sign-in: the request asks for a patient in context. Enter the patient id.",
                };
#pragma warning restore CS8524
            }

            if (FhirPersona.NewSignInReasonFor(User, aud, loginHint, scopes) == NewSignInReason.TieredRequest)
            {
                PersonaMessage = "This request uses the udap scope and needs a sign-in that is not a FHIR resource sign-in.";
            }

            return Page();
        }

        public async Task<IActionResult> OnPost()
        {
            // check if we are in the context of an authorization request
            var context = await _interaction.GetAuthorizationContextAsync(Input.ReturnUrl, HttpContext.RequestAborted);

            // the user clicked the "cancel" button
            if (Input.Button != "login")
            {
                if (context != null)
                {
                    // if the user cancels, send a result back into IdentityServer as if they 
                    // denied the consent (even if this client does not require consent).
                    // this will send back an access denied OIDC error response to the client.
                    await _interaction.DenyAuthorizationAsync(context, InteractionError.AccessDenied, HttpContext.RequestAborted);

                    // we can trust model.ReturnUrl since GetAuthorizationContextAsync returned non-null
                    if (context.IsNativeClient())
                    {
                        // The client is native, so this change in how to
                        // return the response is for better UX for the end user.
                        return this.LoadingPage(Input.ReturnUrl);
                    }

                    return Redirect(Input.ReturnUrl);
                }
                else
                {
                    // since we don't have a valid context, then we just go back to the home page
                    return Redirect("~/");
                }
            }

            if (ModelState.IsValid)
            {
                // validate username/password against in-memory store
                if (_users.ValidateCredentials(Input.Username, Input.Password))
                {
                    var user = _users.FindByUsername(Input.Username);
                    await _events.RaiseAsync(new UserLoginSuccessEvent(user.Username, user.SubjectId, user.Username, clientId: context?.Client.ClientId), HttpContext.RequestAborted);

                    // only set explicit expiration here if user chooses "remember me". 
                    // otherwise we rely upon expiration configured in cookie middleware.
                    AuthenticationProperties props = null;
                    if (LoginOptions.AllowRememberLogin && Input.RememberLogin)
                    {
                        props = new AuthenticationProperties
                        {
                            IsPersistent = true,
                            ExpiresUtc = DateTimeOffset.UtcNow.Add(LoginOptions.RememberMeLoginDuration)
                        };
                    };

                    // issue authentication cookie with subject ID and username
                    var isuser = new IdentityServerUser(user.SubjectId)
                    {
                        DisplayName = user.Username
                    };

                    await HttpContext.SignInAsync(isuser, props);

                    if (context != null)
                    {
                        if (context.IsNativeClient())
                        {
                            // The client is native, so this change in how to
                            // return the response is for better UX for the end user.
                            return this.LoadingPage(Input.ReturnUrl);
                        }

                        // we can trust model.ReturnUrl since GetAuthorizationContextAsync returned non-null
                        return Redirect(Input.ReturnUrl);
                    }

                    // request for a local page
                    if (Url.IsLocalUrl(Input.ReturnUrl))
                    {
                        return Redirect(Input.ReturnUrl);
                    }
                    else if (string.IsNullOrEmpty(Input.ReturnUrl))
                    {
                        return Redirect("~/");
                    }
                    else
                    {
                        // user might have clicked on a malicious link - should be logged
                        throw new Exception("invalid return URL");
                    }
                }

                await _events.RaiseAsync(new UserLoginFailureEvent(Input.Username, "invalid credentials", clientId: context?.Client.ClientId), HttpContext.RequestAborted);
                ModelState.AddModelError(string.Empty, LoginOptions.InvalidCredentialsErrorMessage);
            }

            // something went wrong, show form with error
            await BuildModelAsync(Input.ReturnUrl);
            return Page();
        }

        public async Task<IActionResult> OnPostPersona()
        {
            // The required fields of the password form do not apply to this form. An empty model state also makes the page show the model values, such as the fixed base, in place of the posted values.
            ModelState.Clear();
            await BuildModelAsync(Persona?.ReturnUrl!, fillFromRequest: false);

            // With no fill from the request, the model keeps the posted values, and a valid aud replaces the base.
            var persona = Persona!;
            var (fhirBase, type, id, patientId, returnUrl) = (persona.FhirBase, persona.ResourceType, persona.ResourceId, persona.PatientId, persona.ReturnUrl);
            var needsPatient = type != "Patient" && PersonaNeedsPatient;
            if (!View.EnableLocalLogin)
            {
                ModelState.AddModelError(string.Empty, "This request does not allow a local sign-in, so it cannot sign in as a FHIR resource.");
            }
            else if (PersonaTiered)
            {
                ModelState.AddModelError(string.Empty, "A request with the udap scope cannot sign in as a FHIR resource.");
            }
            else
            {
                if (!FhirPersona.IsValidBase(fhirBase))
                {
                    ModelState.AddModelError(string.Empty, "The FHIR base URL must be a well-formed absolute http or https URL with no query, no fragment, no white space, and no user name or password.");
                }

                if (!FhirPersona.ResourceTypes.Contains(type))
                {
                    ModelState.AddModelError(string.Empty, $"The resource type must be one of {string.Join(", ", FhirPersona.ResourceTypes)}.");
                }

                if (!FhirPersona.IsValidId(id))
                {
                    ModelState.AddModelError(string.Empty, "The resource id must be a FHIR id: 1 to 64 letters, digits, hyphens, or periods.");
                }

                if (needsPatient && !FhirPersona.IsValidId(patientId))
                {
                    ModelState.AddModelError(string.Empty, "The request asks for a patient in context. The patient id must be a FHIR id.");
                }
            }

            if (!ModelState.IsValid)
            {
                return Page();
            }

            await SignInAsResourceAsync(FhirPersona.CreateUser(fhirBase!, type!, id!, needsPatient ? patientId : null));

            if (_context != null)
            {
                return _context.IsNativeClient() ? this.LoadingPage(returnUrl!) : Redirect(returnUrl!);
            }

            return Redirect("~/");
        }

        private async Task BuildModelAsync(string returnUrl, bool fillFromRequest = true)
        {
            Input = new InputModel
            {
                ReturnUrl = returnUrl
            };

            var context = await _interaction.GetAuthorizationContextAsync(returnUrl, HttpContext.RequestAborted);
            _context = context;
            BuildPersonaModel(returnUrl, context, fillFromRequest);

            if (context?.IdP != null && await _schemeProvider.GetSchemeAsync(context.IdP) != null)
            {
                var local = context.IdP == Duende.IdentityServer.IdentityServerConstants.LocalIdentityProvider;

                // this is meant to short circuit the UI and only trigger the one external IdP
                View = new ViewModel
                {
                    EnableLocalLogin = local,
                };

                Input.Username = context?.LoginHint;

                if (!local)
                {
                    View.ExternalProviders = new[] { new ViewModel.ExternalProvider { AuthenticationScheme = context.IdP } };
                }

                return;
            }

            var schemes = await _schemeProvider.GetAllSchemesAsync();

            var providers = schemes
                .Where(x => x.DisplayName != null)
                //.Select(x => new ViewModel.ExternalProvider
                //{
                //    DisplayName = x.DisplayName ?? x.Name,
                //    AuthenticationScheme = x.Name
                //}).ToList();
                .Select(x =>
                {
                    var externalProvider = new ViewModel.ExternalProvider
                    {
                        DisplayName = x.DisplayName ?? x.Name,
                        AuthenticationScheme = x.Name,
                        ReturnUrl = returnUrl
                    };

                    if (QueryHelpers.ParseQuery(HttpUtility.UrlDecode(returnUrl)).TryGetValue("idp", out var udapIdp))
                    {
                        externalProvider.TieredOAuthIdp = udapIdp.FirstOrDefault();
                    }

                    return externalProvider;
                }).ToList();

            var dyanmicSchemes = (await _identityProviderStore.GetAllSchemeNamesAsync(HttpContext.RequestAborted))
                .Where(x => x.Enabled)
                .Select(x => new ViewModel.ExternalProvider
                {
                    AuthenticationScheme = x.Scheme,
                    DisplayName = x.DisplayName
                });
            providers.AddRange(dyanmicSchemes);


            var allowLocal = true;
            var client = context?.Client;
            if (client != null)
            {
                allowLocal = client.EnableLocalLogin;
                if (client.IdentityProviderRestrictions != null && client.IdentityProviderRestrictions.Any())
                {
                    providers = providers.Where(provider => client.IdentityProviderRestrictions.Contains(provider.AuthenticationScheme)).ToList();
                }
            }

            View = new ViewModel
            {
                AllowRememberLogin = LoginOptions.AllowRememberLogin,
                EnableLocalLogin = allowLocal && LoginOptions.AllowLocalLogin,
                ExternalProviders = providers.ToArray()
            };
        }

        // A valid aud fixes the base of the resource form. A GET and a redisplay of the password form also fill the base from aud and the type and id from a resource login_hint. A refused resource post keeps the values that the tester sends.
        private void BuildPersonaModel(string? returnUrl, AuthorizationRequest? context, bool fillFromRequest)
        {
            var (aud, loginHint, _, scopes) = PersonaRequest(context);
            PersonaTiered = FhirPersona.IsTieredRequest(scopes);
            PersonaBaseFixed = FhirPersona.IsValidBase(aud);
            PersonaNeedsPatient = FhirPersona.WantsPatient(scopes);

            Persona ??= new PersonaInputModel();
            Persona.ReturnUrl = returnUrl;
            if (fillFromRequest)
            {
                Persona.FhirBase = aud;
                if (FhirPersona.TryParseHint(loginHint, out var type, out var id))
                {
                    (Persona.ResourceType, Persona.ResourceId) = (type, id);
                }
            }

            if (PersonaBaseFixed)
            {
                // The input tag helper shows an attempted value of the model state in place of the model value.
                Persona.FhirBase = aud;
                ModelState.Remove($"{nameof(Persona)}.{nameof(PersonaInputModel.FhirBase)}");
            }
        }

        // A resource sign-in raises the same event as the password form.
        private async Task SignInAsResourceAsync(IdentityServerUser user)
        {
            await _events.RaiseAsync(new UserLoginSuccessEvent(user.DisplayName, user.SubjectId, user.DisplayName, clientId: _context?.Client.ClientId), HttpContext.RequestAborted);
            await HttpContext.SignInAsync(user);
        }

        // Each value is null when the page has no authorize request.
        private static (string? Aud, string? LoginHint, string? SignIn, IEnumerable<string>? Scopes) PersonaRequest(AuthorizationRequest? context) =>
            (context?.Parameters["aud"], context?.LoginHint, context?.Parameters[FhirPersona.SignInParameter], context?.ValidatedResources.RawScopeValues);
    }
}