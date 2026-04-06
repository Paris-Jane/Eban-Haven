using EbanHaven.Api.Admin;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<SiteOptions>(builder.Configuration.GetSection(SiteOptions.SectionName));
builder.Services.AddSingleton<AdminStore>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors();
app.UseHttpsRedirection();

app.MapGet("/api/site", (IOptions<SiteOptions> options) =>
{
    var o = options.Value;
    return Results.Ok(new SiteInfo(o.Name, o.Description));
});

app.MapAdminApi();

app.Run();

internal sealed class SiteOptions
{
    public const string SectionName = "Site";
    public string Name { get; set; } = "Eban Haven";
    public string? Description { get; set; }
}

internal sealed record SiteInfo(string Name, string? Description);
