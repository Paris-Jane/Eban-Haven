namespace EbanHaven.Api.Auth;

// Controllers are used for routing now; keep request records here for reuse.
public sealed record LoginRequest(string Username, string Password, bool RememberMe = false);

public sealed record RegisterRequest(
    string Email,
    string Password,
    string? DisplayName,
    string? SupporterType,
    string? Region,
    string? Country);
