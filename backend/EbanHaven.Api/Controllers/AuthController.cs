using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EbanHaven.Api.Auth;
using Google.Apis.Auth;
using EbanHaven.Api.Configuration;
using EbanHaven.Api.DataAccess;
using EbanHaven.Api.DataAccess.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Options;

namespace EbanHaven.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    HavenDbContext db,
    IConfiguration config,
    IOptions<GoogleAuthOptions> googleAuthOptions,
    IOptions<IdentityOptions> identityOptions) : ControllerBase
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

        var passwordError = PasswordPolicy.Validate(body.Password, identityOptions.Value.Password);
        if (passwordError is not null)
            return BadRequest(new { error = passwordError });

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

    [HttpPost("google")]
    [AllowAnonymous]
    public async Task<IActionResult> Google([FromBody] GoogleAuthRequest body)
    {
        var clientId = googleAuthOptions.Value.ClientId?.Trim();
        if (string.IsNullOrWhiteSpace(clientId))
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "Google authentication is not configured." });

        if (string.IsNullOrWhiteSpace(body.Credential))
            return BadRequest(new { error = "Google credential is required." });

        GoogleJsonWebSignature.Payload payload;
        try
        {
            payload = await GoogleJsonWebSignature.ValidateAsync(
                body.Credential.Trim(),
                new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = [clientId],
                });
        }
        catch (InvalidJwtException)
        {
            return StatusCode(StatusCodes.Status401Unauthorized, new { error = "Google authentication could not be verified." });
        }

        if (!payload.EmailVerified)
            return StatusCode(StatusCodes.Status401Unauthorized, new { error = "Your Google email address must be verified." });
        if (string.IsNullOrWhiteSpace(payload.Email))
            return StatusCode(StatusCodes.Status401Unauthorized, new { error = "Google authentication did not include an email address." });

        var mode = string.Equals(body.Mode, "register", StringComparison.OrdinalIgnoreCase) ? "register" : "login";
        var email = payload.Email.Trim().ToLowerInvariant();

        var profile = await db.Profiles.FirstOrDefaultAsync(p => p.Email != null && p.Email.ToLower() == email);
        if (profile is null && mode == "login")
            return NotFound(new { error = "No donor account exists for this Google email yet. Use Google sign up first." });

        var displayName = string.IsNullOrWhiteSpace(payload.Name) ? email : payload.Name.Trim();

        if (profile is null)
        {
            profile = new Profile
            {
                Email = email,
                FullName = displayName,
                Role = "donor",
                PasswordHash = null,
                IsActive = true,
            };
            db.Profiles.Add(profile);
        }
        else
        {
            if (!AllowedRoles.Contains(profile.Role))
                return StatusCode(StatusCodes.Status403Forbidden, new { error = "This account cannot access the portal." });
            if (!profile.IsActive)
                return StatusCode(StatusCodes.Status403Forbidden, new { error = "This account is inactive." });
            if (string.IsNullOrWhiteSpace(profile.FullName))
                profile.FullName = displayName;
        }

        var supporter = await db.Supporters.FirstOrDefaultAsync(s => s.Email != null && s.Email.ToLower() == email);
        if (supporter is null)
        {
            db.Supporters.Add(new DataAccess.Entities.Supporter
            {
                SupporterType = "MonetaryDonor",
                DisplayName = displayName,
                Email = email,
                Country = "Ghana",
                Status = "Active",
            });
        }
        else if (string.IsNullOrWhiteSpace(supporter.DisplayName))
        {
            supporter.DisplayName = displayName;
        }

        await db.SaveChangesAsync();

        var token = IssueToken(email, profile.FullName ?? displayName, profile.Role);
        return Ok(new { token, role = profile.Role });
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
        // Prefer semantic role from JWT ("role" claim). ClaimTypes.Role is mapped to "Staff" for staff accounts.
        var role = User.FindFirst("role")?.Value
            ?? User.FindFirst(ClaimTypes.Role)?.Value
            ?? "staff";
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
            new(ClaimTypes.NameIdentifier, username),
            new(ClaimTypes.Name, displayName?.Trim() ?? username),
            new(ClaimTypes.Email, username),
            new(ClaimTypes.Role, role),
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

public sealed record GoogleAuthRequest(string Credential, string? Mode);
