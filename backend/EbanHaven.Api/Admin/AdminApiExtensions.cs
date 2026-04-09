using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using EbanHaven.Api.Lighthouse;

namespace EbanHaven.Api.Admin;

public static class AdminApiExtensions
{
    public static void MapAdminApi(this WebApplication app)
    {
        app.MapGet("/api/admin/dashboard", (ILighthouseRepository repo) => Results.Ok(repo.GetAdminDashboard()))
            .AllowAnonymous();

        var admin = app.MapGroup("/api/admin").RequireAuthorization();

        admin.MapGet("/safehouses", (ILighthouseRepository repo) => Results.Ok(repo.ListSafehousesOptions()));

        admin.MapGet("/supporters", (ILighthouseRepository repo) => Results.Ok(repo.ListSupporters()));
        admin.MapPost("/supporters", (CreateSupporterRequest body, ILighthouseRepository repo) =>
        {
            if (string.IsNullOrWhiteSpace(body.SupporterType))
                return Results.BadRequest(new { error = "SupporterType is required." });
            if (string.IsNullOrWhiteSpace(body.DisplayName))
                return Results.BadRequest(new { error = "DisplayName is required." });
            var status = string.IsNullOrWhiteSpace(body.Status) ? "Active" : body.Status.Trim();
            var created = repo.CreateSupporter(
                body.SupporterType.Trim(),
                body.DisplayName.Trim(),
                body.Email?.Trim(),
                body.Region?.Trim(),
                status);
            return Results.Created($"/api/admin/supporters/{created.Id}", created);
        });
        admin.MapPatch("/supporters/{id:int}", (int id, PatchSupporterRequest body, ILighthouseRepository repo) =>
        {
            var u = repo.UpdateSupporter(id, body.Status, body.SupporterType);
            return u is null ? Results.NotFound() : Results.Ok(u);
        });

        admin.MapGet("/donations", (int? supporterId, ILighthouseRepository repo) =>
            Results.Ok(repo.ListDonations(supporterId)));
        admin.MapPost("/donations", (CreateDonationRequest body, ILighthouseRepository repo) =>
        {
            if (body.SupporterId <= 0)
                return Results.BadRequest(new { error = "SupporterId is required." });
            if (string.IsNullOrWhiteSpace(body.DonationType))
                return Results.BadRequest(new { error = "DonationType is required." });
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
                return Results.Created($"/api/admin/donations/{created.Id}", created);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        admin.MapGet("/donation-allocations", (int? donationId, int? safehouseId, ILighthouseRepository repo) =>
            Results.Ok(repo.ListAllocations(donationId, safehouseId)));

        admin.MapGet("/residents", (
            [FromQuery] string? status,
            [FromQuery] int? safehouseId,
            [FromQuery] string? category,
            [FromQuery] string? q,
            ILighthouseRepository repo) => Results.Ok(repo.ListResidents(status, safehouseId, category, q)));

        admin.MapGet("/residents/{id:int}", (int id, ILighthouseRepository repo) =>
        {
            var r = repo.GetResident(id);
            return r is null ? Results.NotFound() : Results.Ok(r);
        });

        admin.MapPatch("/residents/{id:int}", (int id, IReadOnlyDictionary<string, string?> body, ILighthouseRepository repo) =>
        {
            var ok = repo.UpdateResident(id, body);
            return ok ? Results.Ok(repo.GetResident(id)) : Results.NotFound();
        });

        admin.MapPost("/residents", (CreateResidentRequest body, ILighthouseRepository repo) =>
        {
            if (string.IsNullOrWhiteSpace(body.CaseStatus))
                return Results.BadRequest(new { error = "CaseStatus is required." });
            var created = repo.CreateResident(body.InternalCode?.Trim(), body.CaseStatus.Trim(), body.CaseCategory?.Trim());
            return Results.Created($"/api/admin/residents/{created.Id}", created);
        });

        admin.MapPatch("/residents/{id:int}/status", (int id, UpdateCaseStatusRequest body, ILighthouseRepository repo) =>
        {
            if (string.IsNullOrWhiteSpace(body.Status))
                return Results.BadRequest(new { error = "Status is required." });
            var u = repo.UpdateResidentStatus(id, body.Status.Trim());
            return u is null ? Results.NotFound() : Results.Ok(u);
        });

        admin.MapGet("/process-recordings", (int? residentId, ILighthouseRepository repo) =>
            Results.Ok(repo.ListProcessRecordings(residentId)));

        admin.MapPost("/process-recordings", (CreateProcessRecordingRequest body, ILighthouseRepository repo) =>
        {
            if (body.ResidentId <= 0)
                return Results.BadRequest(new { error = "ResidentId is required." });
            if (string.IsNullOrWhiteSpace(body.SocialWorker))
                return Results.BadRequest(new { error = "SocialWorker is required." });
            if (string.IsNullOrWhiteSpace(body.SessionType))
                return Results.BadRequest(new { error = "SessionType is required." });
            if (string.IsNullOrWhiteSpace(body.SessionNarrative))
                return Results.BadRequest(new { error = "SessionNarrative is required." });
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
                return Results.Created($"/api/admin/process-recordings/{created.Id}", created);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        admin.MapPatch("/process-recordings/{id:int}", (int id, PatchProcessRecordingDto body, ILighthouseRepository repo) =>
        {
            var u = repo.PatchProcessRecording(id, body);
            return u is null ? Results.NotFound() : Results.Ok(u);
        });

        admin.MapGet("/home-visitations", (int? residentId, ILighthouseRepository repo) =>
            Results.Ok(repo.ListHomeVisitations(residentId)));

        admin.MapPost("/home-visitations", (CreateHomeVisitationRequest body, ILighthouseRepository repo) =>
        {
            if (body.ResidentId <= 0)
                return Results.BadRequest(new { error = "ResidentId is required." });
            if (string.IsNullOrWhiteSpace(body.SocialWorker))
                return Results.BadRequest(new { error = "SocialWorker is required." });
            if (string.IsNullOrWhiteSpace(body.VisitType))
                return Results.BadRequest(new { error = "VisitType is required." });
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
                return Results.Created($"/api/admin/home-visitations/{created.Id}", created);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        admin.MapPatch("/home-visitations/{id:int}", (int id, PatchHomeVisitationDto body, ILighthouseRepository repo) =>
        {
            var u = repo.PatchHomeVisitation(id, body);
            return u is null ? Results.NotFound() : Results.Ok(u);
        });

        admin.MapGet("/intervention-plans", (int? residentId, ILighthouseRepository repo) =>
            Results.Ok(repo.ListInterventionPlans(residentId)));

        admin.MapGet("/reports/summary", (ILighthouseRepository repo) => Results.Ok(repo.GetReportsSummary()));

        // Legacy aliases for older clients (map residents ↔ cases naming)
        admin.MapGet("/cases", (ILighthouseRepository repo) =>
            Results.Ok(repo.ListResidents(null, null, null, null).Select(LegacyCaseFromSummary).ToList()));
        admin.MapPost("/cases", (LegacyCreateCaseRequest body, ILighthouseRepository repo) =>
        {
            if (string.IsNullOrWhiteSpace(body.ReferenceCode))
                return Results.BadRequest(new { error = "ReferenceCode is required." });
            if (string.IsNullOrWhiteSpace(body.Status))
                return Results.BadRequest(new { error = "Status is required." });
            var created = repo.CreateResident(body.ReferenceCode.Trim(), body.Status.Trim(), null);
            return Results.Created($"/api/admin/cases/{created.Id}", LegacyCaseFromSummary(created));
        });
        admin.MapPatch("/cases/{id:int}/status", (int id, UpdateCaseStatusRequest body, ILighthouseRepository repo) =>
        {
            if (string.IsNullOrWhiteSpace(body.Status))
                return Results.BadRequest(new { error = "Status is required." });
            var u = repo.UpdateResidentStatus(id, body.Status.Trim());
            return u is null ? Results.NotFound() : Results.Ok(LegacyCaseFromSummary(u));
        });

        admin.MapGet("/visitations", (ILighthouseRepository repo) => Results.Ok(repo.ListHomeVisitations(null)));
        admin.MapPost("/visitations", (LegacyCreateVisitationRequest body, ILighthouseRepository repo) =>
        {
            if (string.IsNullOrWhiteSpace(body.VisitorName))
                return Results.BadRequest(new { error = "VisitorName is required." });
            if (!body.CaseId.HasValue || body.CaseId <= 0)
                return Results.BadRequest(new { error = "CaseId (resident id) is required for legacy visitation create." });
            try
            {
                var at = body.ScheduledAt;
                var created = repo.CreateHomeVisitation(
                    body.CaseId.Value,
                    at,
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
                return Results.Created($"/api/admin/visitations/{created.Id}", LegacyVisitationFromDto(created));
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        // ── New REST endpoints replacing Supabase-only paths ─────────────────────

        admin.MapDelete("/supporters/{id:int}", (int id, ILighthouseRepository repo) =>
            repo.DeleteSupporter(id) ? Results.NoContent() : Results.NotFound());

        admin.MapPatch("/supporters/{id:int}/fields", (int id, IReadOnlyDictionary<string, string?> body, ILighthouseRepository repo) =>
        {
            var u = repo.PatchSupporterFields(id, body);
            return u is null ? Results.NotFound() : Results.Ok(u);
        });

        admin.MapDelete("/donations/{id:int}", (int id, ILighthouseRepository repo) =>
            repo.DeleteDonation(id) ? Results.NoContent() : Results.NotFound());

        admin.MapPatch("/donations/{id:int}/fields", (int id, IReadOnlyDictionary<string, string?> body, ILighthouseRepository repo) =>
        {
            var u = repo.PatchDonationFields(id, body);
            return u is null ? Results.NotFound() : Results.Ok(u);
        });

        admin.MapPost("/donation-allocations", (CreateAllocationRequest body, ILighthouseRepository repo) =>
        {
            if (body.DonationId <= 0) return Results.BadRequest(new { error = "DonationId is required." });
            if (body.SafehouseId <= 0) return Results.BadRequest(new { error = "SafehouseId is required." });
            var created = repo.CreateAllocation(body.DonationId, body.SafehouseId, body.Amount, body.Notes, body.ProgramArea);
            return Results.Created($"/api/admin/donation-allocations/{created.Id}", created);
        });

        admin.MapPatch("/donation-allocations/{id:int}", (int id, IReadOnlyDictionary<string, string?> body, ILighthouseRepository repo) =>
        {
            var u = repo.PatchAllocationFields(id, body);
            return u is null ? Results.NotFound() : Results.Ok(u);
        });

        admin.MapDelete("/donation-allocations/{id:int}", (int id, ILighthouseRepository repo) =>
            repo.DeleteAllocation(id) ? Results.NoContent() : Results.NotFound());

        admin.MapPost("/intervention-plans", (CreateInterventionPlanRequest body, ILighthouseRepository repo) =>
        {
            if (body.ResidentId <= 0) return Results.BadRequest(new { error = "ResidentId is required." });
            if (string.IsNullOrWhiteSpace(body.PlanCategory)) return Results.BadRequest(new { error = "PlanCategory is required." });
            if (string.IsNullOrWhiteSpace(body.PlanDescription)) return Results.BadRequest(new { error = "PlanDescription is required." });
            DateOnly? targetDate = null;
            if (!string.IsNullOrWhiteSpace(body.TargetDate) && DateOnly.TryParse(body.TargetDate, out var td)) targetDate = td;
            DateOnly? confDate = null;
            if (!string.IsNullOrWhiteSpace(body.CaseConferenceDate) && DateOnly.TryParse(body.CaseConferenceDate, out var cd)) confDate = cd;
                var created = repo.CreateInterventionPlan(
                body.ResidentId,
                body.PlanCategory.Trim(),
                body.PlanDescription.Trim(),
                body.Status?.Trim(),
                targetDate,
                confDate,
                body.TargetValue,
                body.ServicesProvided?.Trim());
            return Results.Created($"/api/admin/intervention-plans/{created.Id}", created);
        });

        admin.MapPatch("/intervention-plans/{id:int}", (int id, PatchInterventionPlanDto body, ILighthouseRepository repo) =>
        {
            var u = repo.PatchInterventionPlan(id, body);
            return u is null ? Results.NotFound() : Results.Ok(u);
        });

        admin.MapDelete("/intervention-plans/{id:int}", (int id, ILighthouseRepository repo) =>
            repo.DeleteInterventionPlan(id) ? Results.NoContent() : Results.NotFound());

        admin.MapDelete("/residents/{id:int}", (int id, ILighthouseRepository repo) =>
            repo.DeleteResident(id) ? Results.NoContent() : Results.NotFound());

        admin.MapDelete("/process-recordings/{id:int}", (int id, ILighthouseRepository repo) =>
            repo.DeleteProcessRecording(id) ? Results.NoContent() : Results.NotFound());

        admin.MapDelete("/home-visitations/{id:int}", (int id, ILighthouseRepository repo) =>
            repo.DeleteHomeVisitation(id) ? Results.NoContent() : Results.NotFound());

        admin.MapGet("/education-records", (int? residentId, ILighthouseRepository repo) =>
            Results.Ok(repo.ListEducationRecords(residentId)));

        admin.MapPost("/education-records", (CreateEducationRecordRequest body, ILighthouseRepository repo) =>
        {
            if (body.ResidentId <= 0) return Results.BadRequest(new { error = "ResidentId is required." });
            var date = body.RecordDate.HasValue
                ? body.RecordDate.Value
                : DateOnly.FromDateTime(DateTime.UtcNow);
            var created = repo.CreateEducationRecord(body.ResidentId, date, body.ProgressPercent, body.ExtendedJson);
            return Results.Created($"/api/admin/education-records/{created.Id}", created);
        });

        admin.MapPatch("/education-records/{id:int}", (int id, PatchEducationRecordRequest body, ILighthouseRepository repo) =>
        {
            DateOnly? date = null;
            if (body.RecordDate.HasValue) date = body.RecordDate.Value;
            var u = repo.PatchEducationRecord(id, body.ProgressPercent, date, body.ExtendedJson);
            return u is null ? Results.NotFound() : Results.Ok(u);
        });

        admin.MapGet("/health-records", (int? residentId, ILighthouseRepository repo) =>
            Results.Ok(repo.ListHealthRecords(residentId)));

        admin.MapPost("/health-records", (CreateHealthRecordRequest body, ILighthouseRepository repo) =>
        {
            if (body.ResidentId <= 0) return Results.BadRequest(new { error = "ResidentId is required." });
            var date = body.RecordDate.HasValue
                ? body.RecordDate.Value
                : DateOnly.FromDateTime(DateTime.UtcNow);
            var created = repo.CreateHealthRecord(body.ResidentId, date, body.HealthScore, body.ExtendedJson);
            return Results.Created($"/api/admin/health-records/{created.Id}", created);
        });

        admin.MapPatch("/health-records/{id:int}", (int id, PatchHealthRecordRequest body, ILighthouseRepository repo) =>
        {
            DateOnly? date = null;
            if (body.RecordDate.HasValue) date = body.RecordDate.Value;
            var u = repo.PatchHealthRecord(id, body.HealthScore, date, body.ExtendedJson);
            return u is null ? Results.NotFound() : Results.Ok(u);
        });
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

public sealed record CreateSupporterRequest(
    string SupporterType,
    string DisplayName,
    string? Email,
    string? Region,
    string? Status);

public sealed record PatchSupporterRequest(string? Status, string? SupporterType);

public sealed record CreateDonationRequest(
    int SupporterId,
    string DonationType,
    DateTime? DonationDate,
    decimal? Amount,
    string? CurrencyCode,
    string? Notes,
    string? CampaignName);

public sealed record CreateResidentRequest(string? InternalCode, string CaseStatus, string? CaseCategory);

public sealed record UpdateCaseStatusRequest(string Status);

public sealed record CreateProcessRecordingRequest(
    int ResidentId,
    DateTime? SessionDate,
    string SocialWorker,
    string SessionType,
    int? SessionDurationMinutes,
    string? EmotionalStateObserved,
    string? EmotionalStateEnd,
    string SessionNarrative,
    string? InterventionsApplied,
    string? FollowUpActions,
    bool? ProgressNoted,
    bool? ConcernsFlagged,
    bool? ReferralMade);

public sealed record CreateHomeVisitationRequest(
    int ResidentId,
    DateTime? VisitDate,
    string SocialWorker,
    string VisitType,
    string? LocationVisited,
    string? Observations,
    string? FamilyCooperationLevel,
    bool SafetyConcernsNoted,
    bool FollowUpNeeded,
    string? FollowUpNotes,
    string? Purpose,
    string? FamilyMembersPresent,
    string? VisitOutcome);

public sealed record LegacyCreateCaseRequest(string ReferenceCode, string Status, string? Summary);

public sealed record LegacyCreateVisitationRequest(int? CaseId, string VisitorName, DateTime ScheduledAt, string Status);

public sealed record CreateAllocationRequest(int DonationId, int SafehouseId, decimal? Amount, string? Notes, string? ProgramArea);

public sealed record CreateInterventionPlanRequest(
    int ResidentId,
    string PlanCategory,
    string PlanDescription,
    string? Status,
    string? TargetDate,
    string? CaseConferenceDate,
    double? TargetValue,
    string? ServicesProvided);

public sealed record CreateEducationRecordRequest(int ResidentId, DateOnly? RecordDate, double? ProgressPercent, string? ExtendedJson);

public sealed record PatchEducationRecordRequest(double? ProgressPercent, DateOnly? RecordDate, string? ExtendedJson);

public sealed record CreateHealthRecordRequest(int ResidentId, DateOnly? RecordDate, double? HealthScore, string? ExtendedJson);

public sealed record PatchHealthRecordRequest(double? HealthScore, DateOnly? RecordDate, string? ExtendedJson);
