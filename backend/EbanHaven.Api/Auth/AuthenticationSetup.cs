using System.Text;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace EbanHaven.Api.Auth;

internal static class AuthenticationSetup
{
    public static void AddHavenAuthentication(this IServiceCollection services, IConfiguration config)
    {
        var jwtSecret = config["Supabase:JwtSecret"];
        var supabaseUrl = (config["Supabase:Url"] ?? "").TrimEnd('/');

        if (!string.IsNullOrWhiteSpace(jwtSecret))
        {
            services
                .AddAuthentication(o =>
                {
                    o.DefaultScheme = "Hybrid";
                    o.DefaultChallengeScheme = "Hybrid";
                })
                .AddPolicyScheme("Hybrid", "Hybrid auth", o =>
                {
                    o.ForwardDefaultSelector = ctx =>
                    {
                        var auth = ctx.Request.Headers.Authorization.ToString();
                        if (!string.IsNullOrEmpty(auth) &&
                            auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                            return JwtBearerDefaults.AuthenticationScheme;
                        return CookieAuthenticationDefaults.AuthenticationScheme;
                    };
                })
                .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, ConfigureCookie)
                .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, o =>
                {
                    var hasIssuer = !string.IsNullOrEmpty(supabaseUrl);
                    o.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
                        ValidateIssuer = hasIssuer,
                        ValidIssuer = hasIssuer ? $"{supabaseUrl}/auth/v1" : null,
                        ValidateAudience = true,
                        ValidAudience = "authenticated",
                        ValidateLifetime = true,
                        ClockSkew = TimeSpan.FromMinutes(2),
                    };
                    o.Events = new JwtBearerEvents
                    {
                        OnChallenge = context =>
                        {
                            context.HandleResponse();
                            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                            return Task.CompletedTask;
                        },
                    };
                });
        }
        else
        {
            services
                .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
                .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, ConfigureCookie);
        }

        services.AddAuthorization();
    }

    private static void ConfigureCookie(CookieAuthenticationOptions options)
    {
        options.Cookie.Name = "haven_staff";
        options.Cookie.HttpOnly = true;
        // Required for cross-site cookie auth (Vercel frontend → Azure backend).
        options.Cookie.SameSite = SameSiteMode.None;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
    }
}
