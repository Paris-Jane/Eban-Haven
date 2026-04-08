namespace EbanHaven.Api.Configuration;

public sealed class ResendOptions
{
    public const string SectionName = "Resend";

    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.resend.com";
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = "Eban Haven";
    public string ReplyToEmail { get; set; } = string.Empty;
}
