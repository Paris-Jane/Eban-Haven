namespace EbanHaven.Api.Configuration;

public sealed class OpenAIOptions
{
    public const string SectionName = "OpenAI";

    public string ApiKey { get; set; } = string.Empty;

    public string Model { get; set; } = "gpt-5.1";

    public string PexelsApiKey { get; set; } = string.Empty;
}
