using System.Globalization;
using EbanHaven.Api.Admin;
using EbanHaven.Api.Auth;
using EbanHaven.Api.Lighthouse;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

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
    [Authorize(Policy = AdminOnlyPolicy.Name)]
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
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult PatchSupporter(int id, [FromBody] PatchSupporterRequest body)
    {
        var u = repo.UpdateSupporter(id, body.Status, body.SupporterType);
        return u is null ? NotFound() : Ok(u);
    }

    [HttpGet("donations")]
    public IActionResult Donations([FromQuery] int? supporterId) => Ok(repo.ListDonations(supporterId));

    [HttpPost("donations")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult CreateDonation([FromBody] CreateDonationRequest body)
    {
        if (body.SupporterId <= 0)
            return BadRequest(new { error = "SupporterId is required." });
        if (string.IsNullOrWhiteSpace(body.DonationType))
            return BadRequest(new { error = "DonationType is required." });
        try
        {
            var dt = body.DonationDate ?? DateTime.UtcNow;
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
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult PatchResident(int id, [FromBody] Dictionary<string, string?> body)
    {
        var ok = repo.UpdateResident(id, body);
        return ok ? Ok(repo.GetResident(id)) : NotFound();
    }

    [HttpPost("residents")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult CreateResident([FromBody] CreateResidentRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.InternalCode))
            return BadRequest(new { error = "InternalCode is required." });
        if (string.IsNullOrWhiteSpace(body.CaseStatus))
            return BadRequest(new { error = "CaseStatus is required." });

        try
        {
            var created = repo.CreateResident(body.InternalCode.Trim(), body.CaseStatus.Trim(), body.CaseCategory?.Trim());
            return Created($"/api/admin/residents/{created.Id}", created);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException pg)
        {
            // Postgres constraint codes: 23505=unique_violation, 23503=foreign_key_violation, 23502=not_null_violation
            // https://www.postgresql.org/docs/current/errcodes-appendix.html
            return pg.SqlState switch
            {
                PostgresErrorCodes.UniqueViolation => Conflict(new
                {
                    error = "A resident with this internal code already exists. Choose a different Internal Code.",
                }),
                PostgresErrorCodes.ForeignKeyViolation => Conflict(new
                {
                    error = "Resident could not be created because a related record is missing (e.g., safehouse). Verify safehouses exist and try again.",
                }),
                PostgresErrorCodes.NotNullViolation => Conflict(new
                {
                    error = "Resident could not be created because the database requires a field that wasn't provided. Contact an admin to update required fields or defaults.",
                }),
                _ => Conflict(new
                {
                    error = "Unable to create resident due to a database constraint.",
                    detail = pg.MessageText,
                }),
            };
        }
        catch (DbUpdateException)
        {
            return Conflict(new { error = "Unable to create resident due to a database constraint." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPatch("residents/{id:int}/status")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
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
    [Authorize(Policy = AdminOnlyPolicy.Name)]
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
                body.FollowUpActions?.Trim(),
                body.ProgressNoted,
                body.ConcernsFlagged,
                body.ReferralMade);
            return Created($"/api/admin/process-recordings/{created.Id}", created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPatch("process-recordings/{id:int}")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult PatchProcessRecording(int id, [FromBody] PatchProcessRecordingDto body)
    {
        var u = repo.PatchProcessRecording(id, body);
        return u is null ? NotFound() : Ok(u);
    }

    [HttpGet("home-visitations")]
    public IActionResult HomeVisitations([FromQuery] int? residentId) => Ok(repo.ListHomeVisitations(residentId));

    [HttpPost("home-visitations")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
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
                body.FollowUpNotes?.Trim(),
                body.Purpose?.Trim(),
                body.FamilyMembersPresent?.Trim(),
                body.VisitOutcome?.Trim());
            return Created($"/api/admin/home-visitations/{created.Id}", created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPatch("home-visitations/{id:int}")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult PatchHomeVisitation(int id, [FromBody] PatchHomeVisitationDto body)
    {
        var u = repo.PatchHomeVisitation(id, body);
        return u is null ? NotFound() : Ok(u);
    }

    [HttpGet("intervention-plans")]
    public IActionResult InterventionPlans([FromQuery] int? residentId) => Ok(repo.ListInterventionPlans(residentId));

    [HttpPost("intervention-plans")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult CreateInterventionPlan([FromBody] CreateInterventionPlanRequest body)
    {
        if (body.ResidentId <= 0) return BadRequest(new { error = "ResidentId is required." });
        if (string.IsNullOrWhiteSpace(body.PlanCategory)) return BadRequest(new { error = "PlanCategory is required." });
        if (string.IsNullOrWhiteSpace(body.PlanDescription)) return BadRequest(new { error = "PlanDescription is required." });
        try
        {
            var targetDate = body.TargetDate != null ? DateOnly.Parse(body.TargetDate) : (DateOnly?)null;
            var confDate   = body.CaseConferenceDate != null ? DateOnly.Parse(body.CaseConferenceDate) : (DateOnly?)null;
            var created = repo.CreateInterventionPlan(body.ResidentId, body.PlanCategory.Trim(), body.PlanDescription.Trim(),
                body.Status?.Trim(), targetDate, confDate, body.TargetValue, body.ServicesProvided?.Trim());
            return Created($"/api/admin/intervention-plans/{created.Id}", created);
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPatch("intervention-plans/{id:int}")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult PatchInterventionPlan(int id, [FromBody] PatchInterventionPlanDto body)
    {
        var u = repo.PatchInterventionPlan(id, body);
        return u is null ? NotFound() : Ok(u);
    }

    [HttpDelete("intervention-plans/{id:int}")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult DeleteInterventionPlan(int id) =>
        repo.DeleteInterventionPlan(id) ? NoContent() : NotFound();

    [HttpDelete("supporters/{id:int}")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult DeleteSupporter(int id) =>
        repo.DeleteSupporter(id) ? NoContent() : NotFound();

    [HttpPatch("supporters/{id:int}/fields")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult PatchSupporterFields(int id, [FromBody] Dictionary<string, string?> body)
    {
        var u = repo.PatchSupporterFields(id, body);
        return u is null ? NotFound() : Ok(u);
    }

    [HttpDelete("donations/{id:int}")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult DeleteDonation(int id) =>
        repo.DeleteDonation(id) ? NoContent() : NotFound();

    [HttpPatch("donations/{id:int}/fields")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult PatchDonationFields(int id, [FromBody] Dictionary<string, string?> body)
    {
        var u = repo.PatchDonationFields(id, body);
        return u is null ? NotFound() : Ok(u);
    }

    [HttpPost("donation-allocations")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult CreateAllocation([FromBody] CreateAllocationRequest body)
    {
        if (body.DonationId <= 0) return BadRequest(new { error = "DonationId is required." });
        if (body.SafehouseId <= 0) return BadRequest(new { error = "SafehouseId is required." });
        try
        {
            var created = repo.CreateAllocation(body.DonationId, body.SafehouseId, body.Amount, body.Notes, body.ProgramArea);
            return Created($"/api/admin/donation-allocations/{created.Id}", created);
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPatch("donation-allocations/{id:int}")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult PatchAllocationFields(int id, [FromBody] Dictionary<string, string?> body)
    {
        var u = repo.PatchAllocationFields(id, body);
        return u is null ? NotFound() : Ok(u);
    }

    [HttpDelete("donation-allocations/{id:int}")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult DeleteAllocation(int id) =>
        repo.DeleteAllocation(id) ? NoContent() : NotFound();

    [HttpDelete("residents/{id:int}")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult DeleteResident(int id) =>
        repo.DeleteResident(id) ? NoContent() : NotFound();

    [HttpDelete("process-recordings/{id:int}")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult DeleteProcessRecording(int id) =>
        repo.DeleteProcessRecording(id) ? NoContent() : NotFound();

    [HttpDelete("home-visitations/{id:int}")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult DeleteHomeVisitation(int id) =>
        repo.DeleteHomeVisitation(id) ? NoContent() : NotFound();

    [HttpGet("incident-reports")]
    public IActionResult IncidentReports([FromQuery] int? residentId) => Ok(repo.ListIncidentReports(residentId));

    [HttpPost("incident-reports")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult CreateIncidentReport([FromBody] CreateIncidentReportRequest body)
    {
        if (body.ResidentId <= 0) return BadRequest(new { error = "ResidentId is required." });
        if (string.IsNullOrWhiteSpace(body.IncidentType)) return BadRequest(new { error = "IncidentType is required." });
        if (string.IsNullOrWhiteSpace(body.Severity)) return BadRequest(new { error = "Severity is required." });
        try
        {
            var date = body.IncidentDate != null
                ? DateOnly.Parse(body.IncidentDate, CultureInfo.InvariantCulture)
                : DateOnly.FromDateTime(DateTime.UtcNow);
            var resDate = !string.IsNullOrWhiteSpace(body.ResolutionDate)
                ? DateOnly.Parse(body.ResolutionDate, CultureInfo.InvariantCulture)
                : (DateOnly?)null;
            var created = repo.CreateIncidentReport(
                body.ResidentId, body.SafehouseId, date,
                body.IncidentType.Trim(), body.Severity.Trim(),
                body.Description?.Trim(), body.ResponseTaken?.Trim(),
                body.Resolved, resDate,
                body.ReportedBy?.Trim(), body.FollowUpRequired);
            return Created($"/api/admin/incident-reports/{created.Id}", created);
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPatch("incident-reports/{id:int}")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult PatchIncidentReport(int id, [FromBody] Dictionary<string, string?> body)
    {
        var u = repo.PatchIncidentReport(id, body);
        return u is null ? NotFound() : Ok(u);
    }

    [HttpDelete("incident-reports/{id:int}")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult DeleteIncidentReport(int id) =>
        repo.DeleteIncidentReport(id) ? NoContent() : NotFound();

    [HttpGet("education-records")]
    public IActionResult EducationRecords([FromQuery] int? residentId) => Ok(repo.ListEducationRecords(residentId));

    [HttpPost("education-records")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult CreateEducationRecord([FromBody] CreateEducationRecordRequest body)
    {
        var date = body.RecordDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var created = repo.CreateEducationRecord(body.ResidentId, date, body.ProgressPercent, body.ExtendedJson);
        return Created($"/api/admin/education-records/{created.Id}", created);
    }

    [HttpPatch("education-records/{id:int}")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult PatchEducationRecord(int id, [FromBody] PatchEducationRecordRequest body)
    {
        var date = body.RecordDate;
        var u = repo.PatchEducationRecord(id, body.ProgressPercent, date, body.ExtendedJson);
        return u is null ? NotFound() : Ok(u);
    }

    [HttpGet("health-records")]
    public IActionResult HealthRecords([FromQuery] int? residentId) => Ok(repo.ListHealthRecords(residentId));

    [HttpPost("health-records")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult CreateHealthRecord([FromBody] CreateHealthRecordRequest body)
    {
        var date = body.RecordDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var created = repo.CreateHealthRecord(body.ResidentId, date, body.HealthScore, body.ExtendedJson);
        return Created($"/api/admin/health-records/{created.Id}", created);
    }

    [HttpPatch("health-records/{id:int}")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
    public IActionResult PatchHealthRecord(int id, [FromBody] PatchHealthRecordRequest body)
    {
        var u = repo.PatchHealthRecord(id, body.HealthScore, body.RecordDate, body.ExtendedJson);
        return u is null ? NotFound() : Ok(u);
    }

    [HttpGet("reports/summary")]
    public IActionResult ReportsSummary() => Ok(repo.GetReportsSummary());

    // Legacy aliases for older clients (map residents ↔ cases naming)
    [HttpGet("cases")]
    public IActionResult Cases() =>
        Ok(repo.ListResidents(null, null, null, null).Select(LegacyCaseFromSummary).ToList());

    [HttpPost("cases")]
    [Authorize(Policy = AdminOnlyPolicy.Name)]
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
    [Authorize(Policy = AdminOnlyPolicy.Name)]
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
    [Authorize(Policy = AdminOnlyPolicy.Name)]
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
                null,
                null,
                null,
                null);
            return Created($"/api/admin/visitations/{created.Id}", LegacyVisitationFromDto(created));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // Request records for new endpoints
    public sealed record CreateIncidentReportRequest(
        int ResidentId, int? SafehouseId, string? IncidentDate, string IncidentType, string Severity,
        string? Description, string? ResponseTaken, bool Resolved, string? ResolutionDate,
        string? ReportedBy, bool FollowUpRequired);
    public sealed record CreateInterventionPlanRequest(
        int ResidentId,
        string PlanCategory,
        string PlanDescription,
        string? Status,
        string? TargetDate,
        string? CaseConferenceDate,
        double? TargetValue,
        string? ServicesProvided);
    public sealed record CreateAllocationRequest(int DonationId, int SafehouseId, decimal? Amount, string? Notes, string? ProgramArea);
    public sealed record CreateEducationRecordRequest(int ResidentId, DateOnly? RecordDate, double? ProgressPercent, string? ExtendedJson);
    public sealed record PatchEducationRecordRequest(double? ProgressPercent, DateOnly? RecordDate, string? ExtendedJson);
    public sealed record CreateHealthRecordRequest(int ResidentId, DateOnly? RecordDate, double? HealthScore, string? ExtendedJson);
    public sealed record PatchHealthRecordRequest(double? HealthScore, DateOnly? RecordDate, string? ExtendedJson);

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
