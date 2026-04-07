using EbanHaven.Api.Admin;
using EbanHaven.Api.Auth;
using EbanHaven.Api.Configuration;
using EbanHaven.Api.DataAccess;
using EbanHaven.Api.Lighthouse;
using EbanHaven.Api.SocialChat;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<SiteOptions>(builder.Configuration.GetSection(SiteOptions.SectionName));
builder.Services.Configure<CorsOptions>(builder.Configuration.GetSection(CorsOptions.SectionName));
builder.Services.Configure<OpenAIOptions>(builder.Configuration.GetSection(OpenAIOptions.SectionName));
builder.Services.AddControllers();

var conn =
    builder.Configuration.GetConnectionString("Supabase")
    ?? builder.Configuration.GetConnectionString("SupaBaseConnection");
if (!string.IsNullOrWhiteSpace(conn))
{
    builder.Services.AddDbContext<HavenDbContext>(o => o.UseNpgsql(conn));
    builder.Services.AddScoped<ILighthouseRepository, SupabaseLighthouseRepository>();
}
else
{
    // Local/dev fallback if Supabase isn't configured yet.
    builder.Services.AddSingleton<LighthouseDataStore>();
    builder.Services.AddSingleton<LighthouseDataStoreAdapter>();
    builder.Services.AddSingleton<ILighthouseRepository>(sp => sp.GetRequiredService<LighthouseDataStoreAdapter>());
}

builder.Services.AddHavenAuthentication(builder.Configuration);
builder.Services.AddSingleton<IProfileRoleLookup, ProfileRoleLookup>();
builder.Services.AddSingleton<IAuthorizationHandler, AdminOnlyHandler>();
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AdminOnlyPolicy.Name, policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.Requirements.Add(new AdminOnlyRequirement());
    });
});

builder.Services.AddScoped<ISocialChatContextService, SocialChatContextService>();
builder.Services.AddScoped<ISocialChatService, OpenAISocialChatService>();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        // Bearer tokens only (no cookies) — avoid AllowCredentials() unless you need cookies.
        // UseRouting → UseCors order is required so preflight and metadata work.
        policy
            .SetIsOriginAllowed(origin => CorsOriginRules.IsAllowed(origin, builder.Configuration))
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseForwardedHeaders();
app.UseHttpsRedirection();
app.UseRouting();
app.UseCors();
// 500 responses from exceptions often omit CORS headers; browsers then report a CORS error instead of the real failure.
app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        var res = context.Response;
        if (res.StatusCode < 400) return Task.CompletedTask;
        if (res.Headers.ContainsKey(HeaderNames.AccessControlAllowOrigin)) return Task.CompletedTask;
        if (!context.Request.Headers.TryGetValue(HeaderNames.Origin, out var origin)) return Task.CompletedTask;
        var o = origin.ToString();
        if (!CorsOriginRules.IsAllowed(o, app.Configuration)) return Task.CompletedTask;
        res.Headers[HeaderNames.AccessControlAllowOrigin] = o;
        res.Headers[HeaderNames.Vary] = HeaderNames.Origin;
        return Task.CompletedTask;
    });
    await next();
});
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// NOTE: configuration POCOs live in `Configuration/*` for controller access.
