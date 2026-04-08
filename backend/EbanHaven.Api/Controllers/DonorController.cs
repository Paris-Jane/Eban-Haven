using System.Security.Claims;
using EbanHaven.Api.Auth;
using EbanHaven.Api.Lighthouse;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EbanHaven.Api.Controllers;

[ApiController]
[Route("api/donor")]
[Authorize(Policy = DonorOnlyPolicy.Name)]
public sealed class DonorController(ILighthouseRepository repo) : ControllerBase
{
    [HttpGet("dashboard")]
    public IActionResult Dashboard()
    {
        var email =
            User.FindFirst(ClaimTypes.Email)?.Value
            ?? User.FindFirst("email")?.Value
            ?? User.FindFirst("sub")?.Value;

        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(new { error = "A valid donor email claim is required." });

        var supporter = repo.ListSupporters()
            .FirstOrDefault(s => string.Equals(s.Email, email, StringComparison.OrdinalIgnoreCase));

        if (supporter is null)
        {
            return Ok(new
            {
                email,
                supporter = (object?)null,
                donations = Array.Empty<DonationDto>(),
                allocations = Array.Empty<DonationAllocationDto>(),
            });
        }

        var donations = repo.ListDonations(supporter.Id)
            .OrderByDescending(d => d.DonationDate)
            .ToArray();

        var donationIds = donations.Select(d => d.Id).ToHashSet();
        var allocations = repo.ListAllocations(null, null)
            .Where(a => donationIds.Contains(a.DonationId))
            .OrderByDescending(a => a.AllocationDate)
            .ToArray();

        return Ok(new
        {
            email,
            supporter,
            donations,
            allocations,
        });
    }

    [HttpPost("donations")]
    public IActionResult CreateDonation([FromBody] DonorCreateDonationRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.DonationType))
            return BadRequest(new { error = "DonationType is required." });

        var email =
            User.FindFirst(ClaimTypes.Email)?.Value
            ?? User.FindFirst("email")?.Value
            ?? User.FindFirst("sub")?.Value;

        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(new { error = "A valid donor email claim is required." });

        var supporter = repo.ListSupporters()
            .FirstOrDefault(s => string.Equals(s.Email, email, StringComparison.OrdinalIgnoreCase));

        if (supporter is null)
            return BadRequest(new { error = "No supporter profile matches your email. Ask staff to add your email to your supporter record." });

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
