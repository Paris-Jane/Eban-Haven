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
}
