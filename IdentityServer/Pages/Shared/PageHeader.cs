namespace IdentityServer.Pages.Shared;

/// <summary>
/// Model for the _PageHeader partial. Icon is a Font Awesome icon name such as "fa-desktop".
/// </summary>
public sealed record PageHeader(string Icon, string Title, string? Subtitle = null);
