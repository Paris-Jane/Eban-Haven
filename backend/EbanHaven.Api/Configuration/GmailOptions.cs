namespace EbanHaven.Api.Configuration;

public sealed class GmailOptions
{
    public const string SectionName = "Gmail";

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public string SenderEmail { get; set; } = string.Empty;
    public string SenderName { get; set; } = "Eban Haven";
}
