namespace EbanHaven.Api.Configuration;

/// <summary>
/// Single place for browser origin checks (CORS policy + error responses).
/// </summary>
public static class CorsOriginRules
{
    public static bool IsAllowed(string? origin, IConfiguration configuration)
    {
        if (string.IsNullOrEmpty(origin)) return false;
        var u = origin.TrimEnd('/');
        var cors = configuration.GetSection(CorsOptions.SectionName).Get<CorsOptions>() ?? new CorsOptions();
        foreach (var o in cors.Origins ?? [])
        {
            if (!string.IsNullOrWhiteSpace(o) && u.Equals(o.TrimEnd('/'), StringComparison.OrdinalIgnoreCase))
                return true;
        }

        if (u.Equals("https://eban-haven.vercel.app", StringComparison.OrdinalIgnoreCase)) return true;
        if (u.StartsWith("http://localhost:", StringComparison.OrdinalIgnoreCase)) return true;
        if (u.StartsWith("http://127.0.0.1:", StringComparison.OrdinalIgnoreCase)) return true;
        if (u.StartsWith("https://", StringComparison.OrdinalIgnoreCase) &&
            u.EndsWith(".vercel.app", StringComparison.OrdinalIgnoreCase) &&
            u.Contains("eban-haven", StringComparison.OrdinalIgnoreCase))
            return true;
        return false;
    }
}
