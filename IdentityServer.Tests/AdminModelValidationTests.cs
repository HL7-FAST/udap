using IdentityServer.Pages.Admin.ApiScopes;
using IdentityServer.Pages.Admin.Clients;
using IdentityServer.Pages.Admin.IdentityScopes;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IdentityServer.Tests;

public class AdminModelValidationTests
{
    // MVC adds an implicit [Required] to each non-nullable reference property.
    // Validator.TryValidateObject does not, so these tests use the MVC validator.
    private static readonly IObjectModelValidator Validator = new ServiceCollection()
        .AddLogging()
        .AddMvcCore()
        .AddDataAnnotations()
        .Services
        .BuildServiceProvider()
        .GetRequiredService<IObjectModelValidator>();

    private static string[] InvalidFields(object model)
    {
        var context = new ActionContext();
        Validator.Validate(context, validationState: null, prefix: "", model);
        return context.ModelState.Where(x => x.Value!.Errors.Count > 0).Select(x => x.Key).ToArray();
    }

    [Fact]
    public void Edit_of_a_client_credentials_client_needs_no_secret_and_no_uris()
    {
        var model = new ClientModel { ClientId = "my-client", Flow = Flow.ClientCredentials, AllowedScopes = "system/Patient.read" };

        Assert.Empty(InvalidFields(model));
    }

    [Fact]
    public void Edit_of_a_code_flow_client_needs_only_the_redirect_uri()
    {
        var model = new ClientModel { ClientId = "flow-client", Flow = Flow.CodeFlowWithPkce, AllowedScopes = "openid" };

        Assert.Equal(new[] { nameof(ClientModel.RedirectUri) }, InvalidFields(model));
    }

    [Fact]
    public void New_client_needs_a_secret()
    {
        var model = new CreateClientModel { ClientId = "my-client", Flow = Flow.ClientCredentials };

        Assert.Equal(new[] { nameof(CreateClientModel.Secret) }, InvalidFields(model));
    }

    [Fact]
    public void Scopes_need_only_a_name()
    {
        Assert.Empty(InvalidFields(new ApiScopeModel { Name = "system/Patient.read" }));
        Assert.Empty(InvalidFields(new IdentityScopeModel { Name = "openid" }));
    }
}
