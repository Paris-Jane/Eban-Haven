using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Npgsql;

namespace EbanHaven.Api.Auth;

public static class AdminOnlyPolicy
{
    public const string Name = "AdminOnly";
}

public sealed class AdminOnlyRequirement : IAuthorizationRequirement;

public interface IProfileRoleLookup
{
    Task<string?> GetRoleAsync(Guid userId, CancellationToken cancellationToken);
}

public sealed class ProfileRoleLookup(IConfiguration configuration) : IProfileRoleLookup
{
    private readonly string? _connectionString =
        configuration.GetConnectionString("Supabase")
        ?? configuration.GetConnectionString("SupaBaseConnection");

    public async Task<string?> GetRoleAsync(Guid userId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_connectionString))
            return null;

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "select role::text from public.profiles where id = @id limit 1";
        cmd.Parameters.AddWithValue("id", userId);

        var result = await cmd.ExecuteScalarAsync(cancellationToken);
        return result as string;
    }
}

public sealed class AdminOnlyHandler(IProfileRoleLookup roleLookup) : AuthorizationHandler<AdminOnlyRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        AdminOnlyRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated != true)
            return;

        // Legacy staff-cookie login has no finer-grained role model. Treat it as admin-capable.
        if (context.User.Claims.Any(static claim =>
            claim.Type == ClaimTypes.Role &&
            string.Equals(claim.Value, "Staff", StringComparison.OrdinalIgnoreCase)))
        {
            context.Succeed(requirement);
            return;
        }

        var sub =
            context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!Guid.TryParse(sub, out var userId))
            return;

        var role = await roleLookup.GetRoleAsync(userId, CancellationToken.None);
        if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
            context.Succeed(requirement);
    }
}
