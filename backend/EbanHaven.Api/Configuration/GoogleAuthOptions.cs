namespace EbanHaven.Api.Configuration;

public sealed class GoogleAuthOptions
{
    public const string SectionName = "GoogleAuth";

    /// <summary>OAuth 2.0 Web client ID (must match frontend <c>VITE_GOOGLE_CLIENT_ID</c>).</summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>Optional; stored for user-secrets parity. GIS + <c>/api/auth/google</c> validates the ID token with Google's tokeninfo API and does not use the secret.</summary>
    public string ClientSecret { get; set; } = string.Empty;
}
