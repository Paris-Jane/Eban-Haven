using System.IdentityModel.Tokens.Jwt;
using EbanHaven.Api.Lighthouse;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EbanHaven.Api.Controllers;

[ApiController]
[Route("api/donor")]
[Authorize]
public sealed class DonorController(ILighthouseRepository repo) : ControllerBase
{
    private string? EmailFromToken()
    {
        // Tokens are issued with `sub` = email (see AuthController.IssueToken).
        return User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value?.Trim().ToLowerInvariant();
    }

    [HttpGet("me")]
    public IActionResult Me()
    {
        var email = EmailFromToken();
        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(new { error = "Missing user identity." });

        var supporter = repo
            .ListSupporters()
            .FirstOrDefault(s => (s.Email ?? "").Trim().ToLowerInvariant() == email);

        return Ok(new { email, supporter });
    }

    [HttpGet("donations")]
    public IActionResult Donations()
    {
        var email = EmailFromToken();
        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(new { error = "Missing user identity." });

        var supporter = repo
            .ListSupporters()
            .FirstOrDefault(s => (s.Email ?? "").Trim().ToLowerInvariant() == email);

        if (supporter is null)
            return Ok(Array.Empty<object>());

        return Ok(repo.ListDonations(supporter.Id));
    }

    [HttpPost("donations")]
    public IActionResult CreateDonation([FromBody] DonorCreateDonationRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.DonationType))
            return BadRequest(new { error = "DonationType is required." });

        var email = EmailFromToken();
        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(new { error = "Missing user identity." });

        var supporter = repo
            .ListSupporters()
            .FirstOrDefault(s => (s.Email ?? "").Trim().ToLowerInvariant() == email);

        if (supporter is null)
            return BadRequest(new { error = "No supporter profile is linked to this account email." });

        try
        {
            var dt = body.DonationDate ?? DateTime.UtcNow.Date;
            var created = repo.CreateDonation(
                supporter.Id,
                body.DonationType.Trim(),
                dt,
                body.Amount,
                body.CurrencyCode,
                body.Notes,
                body.CampaignName);
            return Created($"/api/donor/donations/{created.Id}", created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

public sealed record DonorCreateDonationRequest(
    string DonationType,
    DateTime? DonationDate,
    decimal? Amount,
    string? CurrencyCode,
    string? Notes,
    string? CampaignName);

