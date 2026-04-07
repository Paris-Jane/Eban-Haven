namespace EbanHaven.Api.Configuration;

public sealed class SiteOptions
{
    public const string SectionName = "Site";
    public string Name { get; set; } = "Haven of Hope";
    public string? Description { get; set; }
}

