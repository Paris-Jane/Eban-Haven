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
builder.Services.Configure<GmailOptions>(builder.Configuration.GetSection(GmailOptions.SectionName));
builder.Services.Configure<MetaOptions>(builder.Configuration.GetSection(MetaOptions.SectionName));
builder.Services.AddControllers();

var conn =
    builder.Configuration.GetConnectionString("Supabase")
    ?? builder.Configuration.GetConnectionString("SupaBaseConnection");
if (!string.IsNullOrWhiteSpace(conn))
{
    builder.Services.AddDbContext<HavenDbContext>(o => o.UseNpgsql(conn));
    builder.Services.AddScoped<ILighthouseRepository, SupabaseLighthouseRepository>();
    builder.Services.AddScoped<IPlannedSocialPostStore, DbPlannedSocialPostStore>();
}
else
{
    // Local/dev fallback if Supabase isn't configured yet.
    builder.Services.AddSingleton<LighthouseDataStore>();
    builder.Services.AddSingleton<LighthouseDataStoreAdapter>();
    builder.Services.AddSingleton<ILighthouseRepository>(sp => sp.GetRequiredService<LighthouseDataStoreAdapter>());
    builder.Services.AddSingleton<IPlannedSocialPostStore, InMemoryPlannedSocialPostStore>();
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
builder.Services.AddScoped<IMetaSchedulingService, MetaSchedulingService>();
builder.Services.AddScoped<IDonorEmailComposer, DonorEmailComposer>();
builder.Services.AddScoped<IDonorEmailDeliveryService, DonorEmailDeliveryService>();

builder.Services.AddHttpClient("MlService", client =>
{
    var baseUrl = builder.Configuration["MlService:BaseUrl"] ?? "http://localhost:8000";
    client.BaseAddress = new Uri(baseUrl);
    client.Timeout     = TimeSpan.FromSeconds(30);
});
builder.Services.AddHttpClient("MetaGraph", client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddHttpClient("GoogleOAuth", client =>
{
    client.BaseAddress = new Uri("https://oauth2.googleapis.com");
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.AddHttpClient("GmailApi", client =>
{
    client.BaseAddress = new Uri("https://gmail.googleapis.com");
    client.Timeout = TimeSpan.FromSeconds(30);
});

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
// Ensure error responses include CORS headers and a JSON body (otherwise browsers report "CORS blocked" and hide the real error).
app.Use(async (context, next) =>
{
    void EnsureCorsHeaders()
    {
        var res = context.Response;
        if (res.Headers.ContainsKey(HeaderNames.AccessControlAllowOrigin)) return;
        if (!context.Request.Headers.TryGetValue(HeaderNames.Origin, out var origin)) return;
        var o = origin.ToString();
        if (!CorsOriginRules.IsAllowed(o, app.Configuration)) return;
        res.Headers[HeaderNames.AccessControlAllowOrigin] = o;
        res.Headers[HeaderNames.Vary] = HeaderNames.Origin;
    }

    context.Response.OnStarting(() =>
    {
        if (context.Response.StatusCode >= 400) EnsureCorsHeaders();
        return Task.CompletedTask;
    });

    try
    {
        await next();
    }
    catch (Exception)
    {
        // If the response has started, we can't rewrite it.
        if (context.Response.HasStarted) throw;

        context.Response.Clear();
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        EnsureCorsHeaders();
        context.Response.ContentType = "application/json; charset=utf-8";
        await context.Response.WriteAsJsonAsync(new { error = "Server error while processing the request." });
    }
});
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// NOTE: configuration POCOs live in `Configuration/*` for controller access.
