using System.Security.Claims;
using EbanHaven.Api.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace EbanHaven.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IOptions<StaffOptions> staffOptions) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.Username) || string.IsNullOrWhiteSpace(body.Password))
            return BadRequest(new { error = "Username and password are required." });

        var s = staffOptions.Value;
        if (!string.Equals(body.Username.Trim(), s.Username, StringComparison.Ordinal) ||
            !string.Equals(body.Password, s.Password, StringComparison.Ordinal))
            return StatusCode(StatusCodes.Status401Unauthorized, new { error = "Invalid username or password." });

        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, body.Username.Trim()),
            new(ClaimTypes.Role, "Staff"),
        };
        var id = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(id),
            new AuthenticationProperties
            {
                IsPersistent = body.RememberMe,
                ExpiresUtc = body.RememberMe ? DateTimeOffset.UtcNow.AddDays(14) : DateTimeOffset.UtcNow.AddHours(8),
            });
        return Ok(new { ok = true });
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
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
        return Ok(new { user = display });
    }
}

