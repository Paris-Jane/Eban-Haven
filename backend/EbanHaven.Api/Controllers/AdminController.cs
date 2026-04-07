using System.Globalization;
using EbanHaven.Api.Admin;
using EbanHaven.Api.Lighthouse;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EbanHaven.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize]
public sealed class AdminController(ILighthouseRepository repo) : ControllerBase
{
    [HttpGet("dashboard")]
    public IActionResult Dashboard() => Ok(repo.GetAdminDashboard());

    [HttpGet("safehouses")]
    public IActionResult Safehouses() => Ok(repo.ListSafehousesOptions());

    [HttpGet("supporters")]
    public IActionResult Supporters() => Ok(repo.ListSupporters());

    [HttpPost("supporters")]
    public IActionResult CreateSupporter([FromBody] CreateSupporterRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.SupporterType))
            return BadRequest(new { error = "SupporterType is required." });
        if (string.IsNullOrWhiteSpace(body.DisplayName))
            return BadRequest(new { error = "DisplayName is required." });
        var status = string.IsNullOrWhiteSpace(body.Status) ? "Active" : body.Status.Trim();

        var created = repo.CreateSupporter(
            body.SupporterType.Trim(),
            body.DisplayName.Trim(),
            body.Email?.Trim(),
            body.Region?.Trim(),
            status);
        return Created($"/api/admin/supporters/{created.Id}", created);
    }

    [HttpPatch("supporters/{id:int}")]
    public IActionResult PatchSupporter(int id, [FromBody] PatchSupporterRequest body)
    {
        var u = repo.UpdateSupporter(id, body.Status, body.SupporterType);
        return u is null ? NotFound() : Ok(u);
    }

    [HttpGet("donations")]
    public IActionResult Donations([FromQuery] int? supporterId) => Ok(repo.ListDonations(supporterId));

    [HttpPost("donations")]
    public IActionResult CreateDonation([FromBody] CreateDonationRequest body)
    {
        if (body.SupporterId <= 0)
            return BadRequest(new { error = "SupporterId is required." });
        if (string.IsNullOrWhiteSpace(body.DonationType))
            return BadRequest(new { error = "DonationType is required." });
        try
        {
            var dt = body.DonationDate ?? DateTime.UtcNow.Date;
            var created = repo.CreateDonation(
                body.SupporterId,
                body.DonationType.Trim(),
                dt,
                body.Amount,
                body.CurrencyCode,
                body.Notes,
                body.CampaignName);
            return Created($"/api/admin/donations/{created.Id}", created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("donation-allocations")]
    public IActionResult DonationAllocations([FromQuery] int? donationId, [FromQuery] int? safehouseId) =>
        Ok(repo.ListAllocations(donationId, safehouseId));

    [HttpGet("residents")]
    public IActionResult Residents([FromQuery] string? status, [FromQuery] int? safehouseId, [FromQuery] string? category, [FromQuery(Name = "q")] string? q) =>
        Ok(repo.ListResidents(status, safehouseId, category, q));

    [HttpGet("residents/{id:int}")]
    public IActionResult Resident(int id)
    {
        var r = repo.GetResident(id);
        return r is null ? NotFound() : Ok(r);
    }

    [HttpPatch("residents/{id:int}")]
    public IActionResult PatchResident(int id, [FromBody] Dictionary<string, string?> body)
    {
        var ok = repo.UpdateResident(id, body);
        return ok ? Ok(repo.GetResident(id)) : NotFound();
    }

    [HttpPost("residents")]
    public IActionResult CreateResident([FromBody] CreateResidentRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.InternalCode))
            return BadRequest(new { error = "InternalCode is required." });
        if (string.IsNullOrWhiteSpace(body.CaseStatus))
            return BadRequest(new { error = "CaseStatus is required." });

        var created = repo.CreateResident(body.InternalCode.Trim(), body.CaseStatus.Trim(), body.CaseCategory?.Trim());
        return Created($"/api/admin/residents/{created.Id}", created);
    }

    [HttpPatch("residents/{id:int}/status")]
    public IActionResult UpdateResidentStatus(int id, [FromBody] UpdateCaseStatusRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "Status is required." });
        var u = repo.UpdateResidentStatus(id, body.Status.Trim());
        return u is null ? NotFound() : Ok(u);
    }

    [HttpGet("process-recordings")]
    public IActionResult ProcessRecordings([FromQuery] int? residentId) => Ok(repo.ListProcessRecordings(residentId));

    [HttpPost("process-recordings")]
    public IActionResult CreateProcessRecording([FromBody] CreateProcessRecordingRequest body)
    {
        if (body.ResidentId <= 0)
            return BadRequest(new { error = "ResidentId is required." });
        if (string.IsNullOrWhiteSpace(body.SocialWorker))
            return BadRequest(new { error = "SocialWorker is required." });
        if (string.IsNullOrWhiteSpace(body.SessionType))
            return BadRequest(new { error = "SessionType is required." });
        if (string.IsNullOrWhiteSpace(body.SessionNarrative))
            return BadRequest(new { error = "SessionNarrative is required." });
        try
        {
            var at = body.SessionDate ?? DateTime.UtcNow;
            var created = repo.CreateProcessRecording(
                body.ResidentId,
                at,
                body.SocialWorker.Trim(),
                body.SessionType.Trim(),
                body.SessionDurationMinutes,
                body.EmotionalStateObserved?.Trim(),
                body.EmotionalStateEnd?.Trim(),
                body.SessionNarrative.Trim(),
                body.InterventionsApplied?.Trim(),
                body.FollowUpActions?.Trim());
            return Created($"/api/admin/process-recordings/{created.Id}", created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("home-visitations")]
    public IActionResult HomeVisitations([FromQuery] int? residentId) => Ok(repo.ListHomeVisitations(residentId));

    [HttpPost("home-visitations")]
    public IActionResult CreateHomeVisitation([FromBody] CreateHomeVisitationRequest body)
    {
        if (body.ResidentId <= 0)
            return BadRequest(new { error = "ResidentId is required." });
        if (string.IsNullOrWhiteSpace(body.SocialWorker))
            return BadRequest(new { error = "SocialWorker is required." });
        if (string.IsNullOrWhiteSpace(body.VisitType))
            return BadRequest(new { error = "VisitType is required." });
        try
        {
            var at = body.VisitDate ?? DateTime.UtcNow;
            var created = repo.CreateHomeVisitation(
                body.ResidentId,
                at,
                body.SocialWorker.Trim(),
                body.VisitType.Trim(),
                body.LocationVisited?.Trim(),
                body.Observations?.Trim(),
                body.FamilyCooperationLevel?.Trim(),
                body.SafetyConcernsNoted,
                body.FollowUpNeeded,
                body.FollowUpNotes?.Trim());
            return Created($"/api/admin/home-visitations/{created.Id}", created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("intervention-plans")]
    public IActionResult InterventionPlans([FromQuery] int? residentId) => Ok(repo.ListInterventionPlans(residentId));

    [HttpGet("reports/summary")]
    public IActionResult ReportsSummary() => Ok(repo.GetReportsSummary());

    // Legacy aliases for older clients (map residents ↔ cases naming)
    [HttpGet("cases")]
    public IActionResult Cases() =>
        Ok(repo.ListResidents(null, null, null, null).Select(LegacyCaseFromSummary).ToList());

    [HttpPost("cases")]
    public IActionResult CreateCase([FromBody] LegacyCreateCaseRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.ReferenceCode))
            return BadRequest(new { error = "ReferenceCode is required." });
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "Status is required." });
        var created = repo.CreateResident(body.ReferenceCode.Trim(), body.Status.Trim(), null);
        return Created($"/api/admin/cases/{created.Id}", LegacyCaseFromSummary(created));
    }

    [HttpPatch("cases/{id:int}/status")]
    public IActionResult UpdateCaseStatus(int id, [FromBody] UpdateCaseStatusRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.Status))
            return BadRequest(new { error = "Status is required." });
        var u = repo.UpdateResidentStatus(id, body.Status.Trim());
        return u is null ? NotFound() : Ok(LegacyCaseFromSummary(u));
    }

    [HttpGet("visitations")]
    public IActionResult Visitations() => Ok(repo.ListHomeVisitations(null));

    [HttpPost("visitations")]
    public IActionResult CreateVisitation([FromBody] LegacyCreateVisitationRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.VisitorName))
            return BadRequest(new { error = "VisitorName is required." });
        if (!body.CaseId.HasValue || body.CaseId <= 0)
            return BadRequest(new { error = "CaseId (resident id) is required for legacy visitation create." });
        try
        {
            var created = repo.CreateHomeVisitation(
                body.CaseId.Value,
                body.ScheduledAt,
                body.VisitorName.Trim(),
                string.IsNullOrWhiteSpace(body.Status) ? "Routine Follow-Up" : body.Status.Trim(),
                null,
                null,
                null,
                false,
                false,
                null);
            return Created($"/api/admin/visitations/{created.Id}", LegacyVisitationFromDto(created));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    private static object LegacyCaseFromSummary(ResidentSummaryDto r) => new
    {
        id = r.Id.ToString(CultureInfo.InvariantCulture),
        referenceCode = r.InternalCode,
        status = r.CaseStatus,
        opened = r.DateOfAdmission ?? string.Empty,
        summary = (string?)null,
    };

    private static object LegacyVisitationFromDto(HomeVisitationDto v) => new
    {
        id = v.Id.ToString(CultureInfo.InvariantCulture),
        caseId = v.ResidentId.ToString(CultureInfo.InvariantCulture),
        visitorName = v.SocialWorker,
        scheduledAt = v.VisitDate.ToString("o"),
        status = v.VisitType,
    };
}

