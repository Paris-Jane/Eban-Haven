using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Npgsql;

namespace EbanHaven.Api.Auth;

public static class AdminOnlyPolicy
{
    public const string Name = "AdminOnly";
}

public static class DonorOnlyPolicy
{
    public const string Name = "DonorOnly";
}

public sealed class AdminOnlyRequirement : IAuthorizationRequirement;
public sealed class DonorOnlyRequirement : IAuthorizationRequirement;

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
        if (await RoleAuthorizationHelpers.UserRoleMatchesAsync(context.User, "admin", roleLookup))
            context.Succeed(requirement);
    }
}

public sealed class DonorOnlyHandler(IProfileRoleLookup roleLookup) : AuthorizationHandler<DonorOnlyRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        DonorOnlyRequirement requirement)
    {
        if (await RoleAuthorizationHelpers.UserRoleMatchesAsync(context.User, "donor", roleLookup))
            context.Succeed(requirement);
    }
}

internal static class RoleAuthorizationHelpers
{
    public static async Task<bool> UserRoleMatchesAsync(
        ClaimsPrincipal user,
        string expectedRole,
        IProfileRoleLookup roleLookup)
    {
        if (user.Identity?.IsAuthenticated != true)
            return false;

        var customRole = user.FindFirst("role")?.Value;
        if (string.Equals(customRole, expectedRole, StringComparison.OrdinalIgnoreCase))
            return true;

        var frameworkRole = user.FindFirst(ClaimTypes.Role)?.Value;
        if (string.Equals(frameworkRole, expectedRole, StringComparison.OrdinalIgnoreCase))
            return true;

        var sub =
            user.FindFirst("sub")?.Value
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (!Guid.TryParse(sub, out var userId))
            return false;

        var role = await roleLookup.GetRoleAsync(userId, CancellationToken.None);
        return string.Equals(role, expectedRole, StringComparison.OrdinalIgnoreCase);
    }
}
