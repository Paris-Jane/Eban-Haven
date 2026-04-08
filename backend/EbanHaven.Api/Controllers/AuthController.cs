using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EbanHaven.Api.Auth;
using EbanHaven.Api.DataAccess;
using EbanHaven.Api.DataAccess.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace EbanHaven.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(HavenDbContext db, IConfiguration config) : ControllerBase
{
    private static readonly string[] AllowedRoles = ["admin", "social_worker", "staff", "donor", "resident"];

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.Username) || string.IsNullOrWhiteSpace(body.Password))
            return BadRequest(new { error = "Username and password are required." });

        var email = body.Username.Trim().ToLowerInvariant();
        var user = await db.Profiles.AsNoTracking()
            .FirstOrDefaultAsync(p =>
                p.Email != null &&
                p.Email.ToLower() == email &&
                p.IsActive &&
                AllowedRoles.Contains(p.Role));
        if (user is null)
            return StatusCode(StatusCodes.Status401Unauthorized, new { error = "Invalid username or password." });
        if (string.IsNullOrWhiteSpace(user.PasswordHash))
            return StatusCode(StatusCodes.Status401Unauthorized, new { error = "Invalid username or password." });

        var hasher = new PasswordHasher<object>();
        var ok = hasher.VerifyHashedPassword(new object(), user.PasswordHash!, body.Password) != PasswordVerificationResult.Failed;
        if (!ok)
            return StatusCode(StatusCodes.Status401Unauthorized, new { error = "Invalid username or password." });

        var token = IssueToken(user.Email ?? email, user.FullName, user.Role);
        return Ok(new { token, role = user.Role });
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] RegisterRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.Email) || string.IsNullOrWhiteSpace(body.Password))
            return BadRequest(new { error = "Email and password are required." });

        var email = body.Email.Trim().ToLowerInvariant();
        var exists = await db.Profiles.AnyAsync(p => p.Email != null && p.Email.ToLower() == email);
        if (exists)
            return Conflict(new { error = "An account with this email already exists." });

        var hasher = new PasswordHasher<object>();
        var hash = hasher.HashPassword(new object(), body.Password);

        var profile = new Profile
        {
            Email = email,
            FullName = body.DisplayName?.Trim() ?? email,
            Role = "donor",
            PasswordHash = hash,
            IsActive = true,
        };
        db.Profiles.Add(profile);

        // Also create a supporter record if one doesn't exist
        var supporterExists = await db.Supporters.AnyAsync(s => s.Email != null && s.Email.ToLower() == email);
        if (!supporterExists)
        {
            db.Supporters.Add(new DataAccess.Entities.Supporter
            {
                SupporterType = body.SupporterType?.Trim() ?? "MonetaryDonor",
                DisplayName = body.DisplayName?.Trim() ?? email,
                Email = email,
                Region = body.Region?.Trim(),
                Country = body.Country?.Trim() ?? "Philippines",
                Status = "Active",
            });
        }

        await db.SaveChangesAsync();

        var token = IssueToken(email, profile.FullName, "donor");
        return Ok(new { token, role = "donor" });
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public IActionResult Logout()
    {
        return Ok(new { ok = true });
    }

    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        if (User.Identity?.IsAuthenticated != true)
            return Unauthorized();
        var display = User.Claims.FirstOrDefault(c => c.Type == "email")?.Value
            ?? User.FindFirst(ClaimTypes.Email)?.Value
            ?? User.Identity.Name;
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "staff";
        return Ok(new { user = display, role });
    }

    private string IssueToken(string username, string? displayName, string role)
    {
        var secret = config["Auth:JwtSecret"];
        var issuer = config["Auth:Issuer"] ?? "EbanHaven.Api";
        if (string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException("Missing Auth:JwtSecret configuration.");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, username),
            new(ClaimTypes.Name, displayName?.Trim() ?? username),
            new(ClaimTypes.Role, role == "admin" || role == "social_worker" || role == "staff" ? "Staff" : role),
            new("role", role),
        };
        var jwt = new JwtSecurityToken(
            issuer: issuer,
            audience: null,
            claims: claims,
            notBefore: DateTime.UtcNow.AddMinutes(-1),
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }
}
