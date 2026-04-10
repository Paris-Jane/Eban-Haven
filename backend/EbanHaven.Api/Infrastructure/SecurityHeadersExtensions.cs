namespace EbanHaven.Api.Infrastructure;

public static class SecurityHeadersExtensions
{
    private const string ContentSecurityPolicy =
        "default-src 'self'; " +
        "base-uri 'self'; " +
        "frame-ancestors 'none'; " +
        "object-src 'none'; " +
        "img-src 'self' data: blob: https://images.unsplash.com https://translate.googleapis.com https://translate.google.com https://www.google.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com https://translate.googleapis.com https://translate.google.com https://www.google.com; " +
        "font-src 'self' data: https://fonts.gstatic.com; " +
        "script-src 'self' https://translate.google.com https://translate.googleapis.com https://www.google.com https://accounts.google.com; " +
        "connect-src 'self' https: wss:; " +
        "frame-src https://translate.google.com https://translate.googleapis.com https://www.google.com https://accounts.google.com; " +
        "form-action 'self'";

    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app)
    {
        return app.Use(async (context, next) =>
        {
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;
                headers["Content-Security-Policy"] = ContentSecurityPolicy;
                headers["X-Content-Type-Options"] = "nosniff";
                headers["X-Frame-Options"] = "DENY";
                headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
                return Task.CompletedTask;
            });

            await next();
        });
    }
}
