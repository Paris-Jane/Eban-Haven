using EbanHaven.Api.Admin;
using EbanHaven.Api.Auth;
using EbanHaven.Api.Configuration;
using EbanHaven.Api.DataAccess;
using EbanHaven.Api.Lighthouse;
using EbanHaven.Api.SocialChat;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<SiteOptions>(builder.Configuration.GetSection(SiteOptions.SectionName));
builder.Services.Configure<StaffOptions>(builder.Configuration.GetSection(StaffOptions.SectionName));
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
        var cors = builder.Configuration.GetSection(CorsOptions.SectionName).Get<CorsOptions>() ?? new CorsOptions();
        var origins = cors.Origins;
        if (origins.Length == 0)
            origins = ["http://localhost:5173", "http://127.0.0.1:5173"];
        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    });
});

var app = builder.Build();

app.UseForwardedHeaders();
app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// NOTE: configuration POCOs live in `Configuration/*` for controller access.
