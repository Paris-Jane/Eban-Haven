namespace EbanHaven.Api.Auth;

public static class PasswordPolicy
{
    public const int MinimumLength = 14;

    public static string? Validate(string? password)
    {
        if (string.IsNullOrWhiteSpace(password))
            return "Password is required.";

        if (password.Length < MinimumLength)
            return $"Password must be at least {MinimumLength} characters long.";

        return null;
    }
}
