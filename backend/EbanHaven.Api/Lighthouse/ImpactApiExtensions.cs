namespace EbanHaven.Api.Lighthouse;

public static class ImpactApiExtensions
{
    public static void MapImpactApi(this WebApplication app)
    {
        var g = app.MapGroup("/api/impact");
        g.MapGet("/summary", (ILighthouseRepository repo) => Results.Ok(repo.GetPublicImpactSummary()));
        g.MapGet("/snapshots", (ILighthouseRepository repo) => Results.Ok(repo.GetPublishedSnapshots()));
    }
}
