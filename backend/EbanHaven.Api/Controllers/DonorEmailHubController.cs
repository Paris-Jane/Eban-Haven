using EbanHaven.Api.Admin;
using EbanHaven.Api.Lighthouse;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EbanHaven.Api.Controllers;

[ApiController]
[Route("api/admin/email-hub")]
[Authorize]
public sealed class DonorEmailHubController(
    ILighthouseRepository repo,
    IDonorEmailComposer composer,
    IDonorEmailDeliveryService deliveryService) : ControllerBase
{
    [HttpGet("supporters/{id:int}")]
    public IActionResult GetProfile(int id)
    {
        var profile = BuildProfile(id);
        return profile is null ? NotFound() : Ok(profile);
    }

    [HttpPost("supporters/{id:int}/compose")]
    public async Task<IActionResult> ComposeEmail(
        int id,
        [FromBody] GenerateDonorEmailRequest request,
        CancellationToken cancellationToken)
    {
        var profile = BuildProfile(id);
        if (profile is null) return NotFound();

        var email = await composer.ComposeAsync(profile, request, cancellationToken);
        return Ok(email);
    }

    [HttpPost("supporters/{id:int}/send")]
    public async Task<IActionResult> SendEmail(
        int id,
        [FromBody] SendDonorEmailRequest request,
        CancellationToken cancellationToken)
    {
        var supporter = repo.ListSupporters().FirstOrDefault(s => s.Id == id);
        if (supporter is null) return NotFound();

        if (string.IsNullOrWhiteSpace(request.ToEmail))
            return BadRequest(new { error = "Recipient email is required." });
        if (string.IsNullOrWhiteSpace(request.Subject))
            return BadRequest(new { error = "Subject is required." });
        if (string.IsNullOrWhiteSpace(request.Body) || string.IsNullOrWhiteSpace(request.HtmlBody))
            return BadRequest(new { error = "Email content is required." });

        var sent = await deliveryService.SendAsync(request, cancellationToken);
        return Ok(sent);
    }

    private DonorEmailProfileDto? BuildProfile(int supporterId)
    {
        var supporter = repo.ListSupporters().FirstOrDefault(s => s.Id == supporterId);
        if (supporter is null) return null;

        var donations = repo.ListDonations(supporterId)
            .OrderByDescending(d => d.DonationDate)
            .ToArray();
        var donationIds = donations.Select(d => d.Id).ToHashSet();
        var allocations = repo.ListAllocations(null, null)
            .Where(a => donationIds.Contains(a.DonationId))
            .OrderByDescending(a => a.AllocationDate)
            .ToArray();

        var lifetimeMonetaryTotal = donations
            .Where(d => string.Equals(d.DonationType, "Monetary", StringComparison.OrdinalIgnoreCase))
            .Sum(d => d.Amount ?? 0m);
        var preferredCurrencyCode = donations
            .Select(d => d.CurrencyCode)
            .FirstOrDefault(code => !string.IsNullOrWhiteSpace(code))
            ?? "PHP";
        var largestGiftAmount = donations
            .Where(d => d.Amount.HasValue)
            .Select(d => d.Amount!.Value)
            .DefaultIfEmpty()
            .Max();
        var mostRecentDonationDate = donations.FirstOrDefault()?.DonationDate;
        var hasRecurringGift = donations.Any(d => d.IsRecurring);
        var recentCampaigns = donations
            .Select(d => d.CampaignName)
            .Where(static name => !string.IsNullOrWhiteSpace(name))
            .Select(static name => name!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(4)
            .ToArray();
        var programAreas = allocations
            .Select(a => a.ProgramArea)
            .Where(static area => !string.IsNullOrWhiteSpace(area))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(4)
            .ToArray();

        return new DonorEmailProfileDto(
            supporter,
            donations.Length,
            lifetimeMonetaryTotal,
            preferredCurrencyCode,
            largestGiftAmount > 0 ? largestGiftAmount : null,
            mostRecentDonationDate,
            hasRecurringGift,
            recentCampaigns,
            programAreas,
            donations.Take(8).ToArray(),
            allocations.Take(8).ToArray(),
            BuildRelationshipSummary(supporter, donations, lifetimeMonetaryTotal, mostRecentDonationDate));
    }

    private static string BuildRelationshipSummary(
        SupporterDto supporter,
        IReadOnlyList<DonationDto> donations,
        decimal lifetimeMonetaryTotal,
        DateTime? mostRecentDonationDate)
    {
        var parts = new List<string>();

        if (!string.IsNullOrWhiteSpace(supporter.SupporterType))
            parts.Add($"{supporter.SupporterType.ToLowerInvariant()} relationship");

        if (donations.Count > 0)
            parts.Add($"{donations.Count} recorded donation{(donations.Count == 1 ? string.Empty : "s")}");

        if (lifetimeMonetaryTotal > 0)
            parts.Add($"lifetime giving of {lifetimeMonetaryTotal:0.##} {(donations.Select(d => d.CurrencyCode).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c)) ?? "PHP")}");

        if (mostRecentDonationDate is not null)
            parts.Add($"most recent gift in {mostRecentDonationDate.Value:MMMM yyyy}");

        if (!string.IsNullOrWhiteSpace(supporter.AcquisitionChannel))
            parts.Add($"connected via {supporter.AcquisitionChannel.Trim()}");

        return parts.Count == 0
            ? "This supporter is in your donor directory and ready for tailored outreach."
            : $"This donor has a {string.Join(", ", parts)}.";
    }
}
