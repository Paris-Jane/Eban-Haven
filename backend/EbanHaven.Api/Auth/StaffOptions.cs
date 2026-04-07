namespace EbanHaven.Api.Auth;

public sealed class StaffOptions
{
    public const string SectionName = "Staff";
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
}
