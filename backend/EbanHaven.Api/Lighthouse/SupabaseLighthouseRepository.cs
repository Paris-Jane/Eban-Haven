using System.Collections.Concurrent;
using System.Data;
using System.Globalization;
using System.Text.RegularExpressions;
using EbanHaven.Api.DataAccess;
using EbanHaven.Api.DataAccess.Entities;
using Microsoft.EntityFrameworkCore;

namespace EbanHaven.Api.Lighthouse;

public sealed class SupabaseLighthouseRepository(HavenDbContext db) : ILighthouseRepository
{
    private static readonly ConcurrentDictionary<string, HashSet<string>> ColumnCache = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Coerce incoming instants to UTC before persisting (JSON often uses <see cref="DateTimeKind.Unspecified"/>).</summary>
    private static DateTime NormalizeDonationUtc(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        };

    private static DateTime DonationDbToUtc(DateTime value) =>
        value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
            : value.ToUniversalTime();

    public AdminDashboardDto GetAdminDashboard()
    {
        var today = DateTime.UtcNow.Date;
        var todayDate = DateOnly.FromDateTime(today);
        var weekStart = today.AddDays(-(int)today.DayOfWeek);

        var activeResidents = db.Residents.Count(r => r.CaseStatus.ToLower() == "active");

        var safehouseRows = db.Safehouses
            .Where(s => s.Status.ToLower() == "active")
            .OrderBy(s => s.SafehouseId)
            .Select(s => new SafehouseOccupancyDto(
                s.SafehouseId,
                s.SafehouseCode,
                s.Name,
                s.Region,
                s.CurrentOccupancy,
                s.CapacityGirls))
            .ToList();

        var supporterLookup = db.Supporters
            .Select(s => new { s.SupporterId, s.DisplayName, s.FirstName, s.LastName })
            .ToDictionary(x => x.SupporterId, x =>
            {
                if (!string.IsNullOrWhiteSpace(x.DisplayName)) return x.DisplayName;
                return $"{x.FirstName} {x.LastName}".Trim();
            });

        var recentDonations = db.Donations
            .OrderByDescending(d => d.DonationDate)
            .Take(8)
            .AsEnumerable()
            .Select(d => new RecentDonationRowDto(
                d.DonationId,
                supporterLookup.TryGetValue(d.SupporterId, out var name) ? name : $"Supporter #{d.SupporterId}",
                d.DonationType,
                d.Amount,
                string.IsNullOrWhiteSpace(d.CurrencyCode) ? null : d.CurrencyCode,
                DonationDbToUtc(d.DonationDate),
                string.IsNullOrWhiteSpace(d.CampaignName) ? null : d.CampaignName))
            .ToList();

        var upcomingConferences = db.InterventionPlans
            .Where(p => p.CaseConferenceDate != null && p.CaseConferenceDate.Value >= todayDate)
            .OrderBy(p => p.CaseConferenceDate)
            .Take(12)
            .Select(p => new { p.PlanId, p.ResidentId, p.PlanCategory, p.Status, p.PlanDescription, p.CaseConferenceDate })
            .ToList()
            .Select(p => new UpcomingConferenceDto(
                p.PlanId,
                p.ResidentId,
                ResidentCode(p.ResidentId),
                p.PlanCategory,
                p.CaseConferenceDate?.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                p.Status,
                string.IsNullOrWhiteSpace(p.PlanDescription) ? null : p.PlanDescription))
            .ToList();

        var cutoff30 = DateTime.UtcNow.AddDays(-30);
        var monetary30 = db.Donations
            .Where(d => d.DonationType.ToLower() == "monetary")
            .Where(d => d.DonationDate >= cutoff30)
            .Sum(d => d.Amount ?? 0m);

        var visit90 = db.HomeVisitations.Count(v => v.VisitDate >= DateOnly.FromDateTime(today.AddDays(-90)));

        var completed = db.Residents.Count(r => r.ReintegrationStatus != null && r.ReintegrationStatus.ToLower() == "completed");
        var inProg = db.Residents.Count(r => r.ReintegrationStatus != null && r.ReintegrationStatus.ToLower() == "in progress");
        var denom = Math.Max(db.Residents.Count(r => r.ReintegrationStatus != null && r.ReintegrationStatus != ""), 1);
        var rate = 100.0 * completed / denom;

        return new AdminDashboardDto(
            activeResidents,
            safehouseRows,
            recentDonations,
            upcomingConferences,
            monetary30,
            db.ProcessRecordings.Count(),
            visit90,
            new ReintegrationKpiDto(completed, inProg, Math.Round(rate, 1)));
    }

    public IReadOnlyList<SafehouseOptionDto> ListSafehousesOptions()
    {
        return db.Safehouses
            .Where(s => s.Status.ToLower() == "active")
            .OrderBy(s => s.SafehouseId)
            .Select(s => new SafehouseOptionDto(s.SafehouseId, s.SafehouseCode, s.Name, s.Region))
            .ToList();
    }

    public IReadOnlyList<SupporterDto> ListSupporters()
    {
        return db.Supporters
            .OrderBy(s => s.SupporterId)
            .Select(s => new SupporterDto(
                s.SupporterId,
                s.SupporterType,
                s.DisplayName,
                NullIfEmpty(s.OrganizationName),
                NullIfEmpty(s.FirstName),
                NullIfEmpty(s.LastName),
                NullIfEmpty(s.Region),
                NullIfEmpty(s.Country),
                NullIfEmpty(s.Email),
                NullIfEmpty(s.Phone),
                s.Status,
                NullIfEmpty(s.FirstDonationDate),
                NullIfEmpty(s.AcquisitionChannel),
                NullIfEmpty(s.RelationshipType)))
            .ToList();
    }

    public SupporterDto CreateSupporter(string supporterType, string displayName, string? email, string? region, string status)
    {
        var row = new Supporter
        {
            SupporterType = supporterType,
            DisplayName = displayName,
            Email = email,
            Region = region,
            Status = status,
            Country = "Philippines",
        };
        db.Supporters.Add(row);
        db.SaveChanges();
        return ListSupporters().First(x => x.Id == row.SupporterId);
    }

    public SupporterDto? UpdateSupporter(int id, string? status, string? supporterType)
    {
        var s = db.Supporters.FirstOrDefault(x => x.SupporterId == id);
        if (s is null) return null;
        if (!string.IsNullOrWhiteSpace(status)) s.Status = status.Trim();
        if (!string.IsNullOrWhiteSpace(supporterType)) s.SupporterType = supporterType.Trim();
        db.SaveChanges();
        return ListSupporters().First(x => x.Id == id);
    }

    public IReadOnlyList<DonationDto> ListDonations(int? supporterId)
    {
        var supporterNames = db.Supporters
            .Select(s => new { s.SupporterId, s.DisplayName, s.FirstName, s.LastName })
            .ToDictionary(x => x.SupporterId, x => !string.IsNullOrWhiteSpace(x.DisplayName) ? x.DisplayName : $"{x.FirstName} {x.LastName}".Trim());

        IQueryable<Donation> q = db.Donations;
        if (supporterId is > 0) q = q.Where(d => d.SupporterId == supporterId.Value);

        return q
            .OrderByDescending(d => d.DonationDate)
            .AsEnumerable()
            .Select(d => new DonationDto(
                d.DonationId,
                d.SupporterId,
                supporterNames.TryGetValue(d.SupporterId, out var n) ? n : $"Supporter #{d.SupporterId}",
                d.DonationType,
                DonationDbToUtc(d.DonationDate),
                d.IsRecurring,
                NullIfEmpty(d.CampaignName),
                NullIfEmpty(d.ChannelSource),
                NullIfEmpty(d.CurrencyCode),
                d.Amount,
                d.EstimatedValue,
                NullIfEmpty(d.ImpactUnit),
                NullIfEmpty(d.Notes)))
            .ToList();
    }

    public DonationDto CreateDonation(int supporterId, string donationType, DateTime donationDate, decimal? amount, string? currencyCode,
        string? notes, string? campaignName)
    {
        if (!db.Supporters.Any(x => x.SupporterId == supporterId))
            throw new InvalidOperationException("Unknown supporter.");

        var row = new Donation
        {
            SupporterId = supporterId,
            DonationType = donationType,
            DonationDate = NormalizeDonationUtc(donationDate),
            IsRecurring = false,
            CampaignName = campaignName,
            ChannelSource = "Direct",
            CurrencyCode = currencyCode ?? (donationType.Equals("Monetary", StringComparison.OrdinalIgnoreCase) ? "PHP" : null),
            Amount = amount,
            EstimatedValue = amount,
            ImpactUnit = donationType.Equals("Time", StringComparison.OrdinalIgnoreCase) ? "hours"
                : donationType.Equals("InKind", StringComparison.OrdinalIgnoreCase) ? "items"
                : donationType.Equals("SocialMedia", StringComparison.OrdinalIgnoreCase) ? "campaigns"
                : "pesos",
            Notes = notes,
        };
        db.Donations.Add(row);
        db.SaveChanges();
        return ListDonations(null).First(x => x.Id == row.DonationId);
    }

    public IReadOnlyList<DonationAllocationDto> ListAllocations(int? donationId, int? safehouseId)
    {
        var safehouseNames = db.Safehouses
            .Select(s => new { s.SafehouseId, s.Name })
            .ToDictionary(x => x.SafehouseId, x => x.Name);

        IQueryable<DonationAllocation> q = db.DonationAllocations;
        if (donationId is > 0) q = q.Where(a => a.DonationId == donationId.Value);
        if (safehouseId is > 0) q = q.Where(a => a.SafehouseId == safehouseId.Value);

        return q
            .OrderByDescending(a => a.AllocationDate)
            .AsEnumerable()
            .Select(a => new DonationAllocationDto(
                a.AllocationId,
                a.DonationId,
                a.SafehouseId,
                safehouseNames.TryGetValue(a.SafehouseId, out var n) ? n : null,
                a.ProgramArea,
                a.AmountAllocated,
                a.AllocationDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                NullIfEmpty(a.AllocationNotes)))
            .ToList();
    }

    public IReadOnlyList<ResidentSummaryDto> ListResidents(string? status, int? safehouseId, string? category, string? search)
    {
        var safehouses = db.Safehouses.Select(s => new { s.SafehouseId, s.Name }).ToDictionary(x => x.SafehouseId, x => x.Name);

        IQueryable<Resident> q = db.Residents;
        if (!string.IsNullOrWhiteSpace(status)) q = q.Where(r => r.CaseStatus.ToLower() == status.Trim().ToLower());
        if (safehouseId is > 0) q = q.Where(r => r.SafehouseId == safehouseId.Value);
        if (!string.IsNullOrWhiteSpace(category)) q = q.Where(r => r.CaseCategory.ToLower().Contains(category.Trim().ToLower()));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            q = q.Where(r =>
                r.InternalCode.ToLower().Contains(s) ||
                r.CaseControlNo.ToLower().Contains(s) ||
                (r.AssignedSocialWorker ?? "").ToLower().Contains(s));
        }

        return q
            .OrderByDescending(r => r.ResidentId)
            .AsEnumerable()
            .Select(r => new ResidentSummaryDto(
                r.ResidentId,
                r.CaseControlNo,
                r.InternalCode,
                r.SafehouseId,
                safehouses.TryGetValue(r.SafehouseId, out var n) ? n : null,
                r.CaseStatus,
                r.CaseCategory,
                r.Sex,
                NullIfEmpty(r.AssignedSocialWorker),
                r.DateOfAdmission?.ToString("yyyy-MM-dd"),
                NullIfEmpty(r.ReintegrationStatus),
                NullIfEmpty(r.ReintegrationType),
                NullIfEmpty(r.PresentAge),
                NullIfEmpty(r.LengthOfStay),
                NullIfEmpty(r.CurrentRiskLevel)))
            .ToList();
    }

    public ResidentDetailDto? GetResident(int id)
    {
        var fields = ReadRowAsStrings("residents", "resident_id", id);
        return fields is null ? null : new ResidentDetailDto(id, fields);
    }

    public bool UpdateResident(int id, IReadOnlyDictionary<string, string?> patch)
    {
        if (patch.Count == 0) return true;

        var columns = GetColumns("residents");
        var pairs = new List<(string Col, string? Val)>();
        foreach (var (k, v) in patch)
        {
            if (v is null) continue;
            if (string.Equals(k, "resident_id", StringComparison.OrdinalIgnoreCase)) continue;
            if (!columns.Contains(k)) continue;
            pairs.Add((k, v));
        }

        if (pairs.Count == 0) return true;

        using var cmd = db.Database.GetDbConnection().CreateCommand();
        if (cmd.Connection!.State != ConnectionState.Open) cmd.Connection.Open();
        cmd.CommandText = $"update public.residents set {string.Join(", ", pairs.Select((p, i) => $"{p.Col} = @p{i}"))} where resident_id = @id";
        var idParam = cmd.CreateParameter();
        idParam.ParameterName = "id";
        idParam.Value = id;
        cmd.Parameters.Add(idParam);
        for (var i = 0; i < pairs.Count; i++)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = $"p{i}";
            p.Value = pairs[i].Val ?? "";
            cmd.Parameters.Add(p);
        }

        var updated = cmd.ExecuteNonQuery();
        return updated > 0;
    }

    public ResidentSummaryDto? UpdateResidentStatus(int id, string caseStatus)
    {
        var r = db.Residents.FirstOrDefault(x => x.ResidentId == id);
        if (r is null) return null;
        r.CaseStatus = caseStatus;
        db.SaveChanges();
        return ListResidents(null, null, null, null).FirstOrDefault(x => x.Id == id);
    }

    public ResidentSummaryDto CreateResident(string internalCode, string caseStatus, string? caseCategory)
    {
        // The UI "quick add" form only supplies internal code + status (+ optional category).
        // Do not hardcode SafehouseId=1; pick a real safehouse row or fail with a clear message.
        var safehouseId = db.Safehouses
            .OrderBy(s => s.SafehouseId)
            .Select(s => s.SafehouseId)
            .FirstOrDefault();
        if (safehouseId <= 0)
            throw new InvalidOperationException("No safehouses exist. Create a safehouse first before adding residents.");

        var row = new Resident
        {
            InternalCode = internalCode,
            CaseStatus = caseStatus,
            CaseCategory = string.IsNullOrWhiteSpace(caseCategory) ? "Surrendered" : caseCategory!,
            Sex = "F",
            SafehouseId = safehouseId,
            CaseControlNo = "",
            AssignedSocialWorker = "SW-01",
            // Let the DB default handle this if the column isn't a string.
            DateOfAdmission = null,
        };
        db.Residents.Add(row);
        db.SaveChanges();

        // If your table doesn't auto-generate case_control_no, approximate the old behavior.
        if (string.IsNullOrWhiteSpace(row.CaseControlNo))
        {
            row.CaseControlNo = $"C{row.ResidentId:D4}";
            db.SaveChanges();
        }

        return ListResidents(null, null, null, null).First(x => x.Id == row.ResidentId);
    }

    public IReadOnlyList<ProcessRecordingDto> ListProcessRecordings(int? residentId)
    {
        IQueryable<ProcessRecording> q = db.ProcessRecordings;
        if (residentId is > 0) q = q.Where(p => p.ResidentId == residentId.Value);

        var list = q
            .OrderBy(p => p.SessionDate)
            .ToList()
            .Select(p => new ProcessRecordingDto(
                p.RecordingId,
                p.ResidentId,
                ResidentCode(p.ResidentId),
                p.SessionDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                p.SocialWorker,
                p.SessionType,
                p.SessionDurationMinutes,
                NullIfEmpty(p.EmotionalStateObserved),
                NullIfEmpty(p.EmotionalStateEnd),
                p.SessionNarrative,
                NullIfEmpty(p.InterventionsApplied),
                NullIfEmpty(p.FollowUpActions),
                p.ProgressNoted,
                p.ConcernsFlagged,
                p.ReferralMade))
            .ToList();

        if (residentId is null && list.Count > 120)
            return list.TakeLast(120).ToList();
        return list;
    }

    public ProcessRecordingDto CreateProcessRecording(int residentId, DateTime sessionDate, string socialWorker, string sessionType,
        int? durationMinutes, string? emotionalStart, string? emotionalEnd, string narrative, string? interventions, string? followUp,
        bool? progressNoted, bool? concernsFlagged, bool? referralMade)
    {
        if (!db.Residents.Any(x => x.ResidentId == residentId))
            throw new InvalidOperationException("Unknown resident.");

        var row = new ProcessRecording
        {
            ResidentId = residentId,
            SessionDate = DateOnly.FromDateTime(sessionDate),
            SocialWorker = socialWorker,
            SessionType = sessionType,
            SessionDurationMinutes = durationMinutes,
            EmotionalStateObserved = emotionalStart,
            EmotionalStateEnd = emotionalEnd,
            SessionNarrative = narrative,
            InterventionsApplied = interventions,
            FollowUpActions = followUp,
            ProgressNoted = progressNoted ?? true,
            ConcernsFlagged = concernsFlagged ?? false,
            ReferralMade = referralMade ?? false,
        };
        db.ProcessRecordings.Add(row);
        db.SaveChanges();
        return ListProcessRecordings(residentId).Last();
    }

    public ProcessRecordingDto? PatchProcessRecording(int id, PatchProcessRecordingDto p)
    {
        var row = db.ProcessRecordings.FirstOrDefault(x => x.RecordingId == id);
        if (row is null) return null;
        if (p.SessionDate.HasValue) row.SessionDate = DateOnly.FromDateTime(p.SessionDate.Value);
        if (p.SocialWorker != null) row.SocialWorker = p.SocialWorker;
        if (p.SessionType != null) row.SessionType = p.SessionType;
        if (p.SessionDurationMinutes.HasValue) row.SessionDurationMinutes = p.SessionDurationMinutes;
        if (p.EmotionalStateObserved != null) row.EmotionalStateObserved = p.EmotionalStateObserved;
        if (p.EmotionalStateEnd != null) row.EmotionalStateEnd = p.EmotionalStateEnd;
        if (p.SessionNarrative != null) row.SessionNarrative = p.SessionNarrative;
        if (p.InterventionsApplied != null) row.InterventionsApplied = p.InterventionsApplied;
        if (p.FollowUpActions != null) row.FollowUpActions = p.FollowUpActions;
        if (p.ProgressNoted.HasValue) row.ProgressNoted = p.ProgressNoted.Value;
        if (p.ConcernsFlagged.HasValue) row.ConcernsFlagged = p.ConcernsFlagged.Value;
        if (p.ReferralMade.HasValue) row.ReferralMade = p.ReferralMade.Value;
        db.SaveChanges();
        return ListProcessRecordings(row.ResidentId).First(x => x.Id == id);
    }

    public IReadOnlyList<HomeVisitationDto> ListHomeVisitations(int? residentId)
    {
        IQueryable<HomeVisitation> q = db.HomeVisitations;
        if (residentId is > 0) q = q.Where(v => v.ResidentId == residentId.Value);

        return q
            .OrderByDescending(v => v.VisitDate)
            .ToList()
            .Select(v => new HomeVisitationDto(
                v.VisitationId,
                v.ResidentId,
                ResidentCode(v.ResidentId),
                v.VisitDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                v.SocialWorker,
                v.VisitType,
                NullIfEmpty(v.LocationVisited),
                NullIfEmpty(v.FamilyMembersPresent),
                NullIfEmpty(v.Purpose),
                NullIfEmpty(v.Observations),
                NullIfEmpty(v.FamilyCooperationLevel),
                v.SafetyConcernsNoted,
                v.FollowUpNeeded,
                NullIfEmpty(v.FollowUpNotes),
                NullIfEmpty(v.VisitOutcome)))
            .ToList();
    }

    public HomeVisitationDto CreateHomeVisitation(int residentId, DateTime visitDate, string socialWorker, string visitType,
        string? locationVisited, string? observations, string? familyCooperation, bool safetyConcerns, bool followUpNeeded,
        string? followUpNotes, string? purpose, string? familyMembersPresent, string? visitOutcome)
    {
        if (!db.Residents.Any(x => x.ResidentId == residentId))
            throw new InvalidOperationException("Unknown resident.");

        var row = new HomeVisitation
        {
            ResidentId = residentId,
            VisitDate = DateOnly.FromDateTime(visitDate),
            SocialWorker = socialWorker,
            VisitType = visitType,
            LocationVisited = locationVisited,
            Observations = observations,
            FamilyCooperationLevel = familyCooperation,
            SafetyConcernsNoted = safetyConcerns,
            FollowUpNeeded = followUpNeeded,
            FollowUpNotes = followUpNotes,
            FamilyMembersPresent = familyMembersPresent,
            Purpose = string.IsNullOrWhiteSpace(purpose) ? $"Visitation for {visitType.ToLowerInvariant()}" : purpose,
            VisitOutcome = string.IsNullOrWhiteSpace(visitOutcome) ? "Favorable" : visitOutcome,
        };
        db.HomeVisitations.Add(row);
        db.SaveChanges();
        return ListHomeVisitations(residentId).First(x => x.Id == row.VisitationId);
    }

    public HomeVisitationDto? PatchHomeVisitation(int id, PatchHomeVisitationDto p)
    {
        var row = db.HomeVisitations.FirstOrDefault(x => x.VisitationId == id);
        if (row is null) return null;
        if (p.VisitDate.HasValue) row.VisitDate = DateOnly.FromDateTime(p.VisitDate.Value);
        if (p.SocialWorker != null) row.SocialWorker = p.SocialWorker;
        if (p.VisitType != null) row.VisitType = p.VisitType;
        if (p.LocationVisited != null) row.LocationVisited = p.LocationVisited;
        if (p.FamilyMembersPresent != null) row.FamilyMembersPresent = p.FamilyMembersPresent;
        if (p.Purpose != null) row.Purpose = p.Purpose;
        if (p.Observations != null) row.Observations = p.Observations;
        if (p.FamilyCooperationLevel != null) row.FamilyCooperationLevel = p.FamilyCooperationLevel;
        if (p.SafetyConcernsNoted.HasValue) row.SafetyConcernsNoted = p.SafetyConcernsNoted.Value;
        if (p.FollowUpNeeded.HasValue) row.FollowUpNeeded = p.FollowUpNeeded.Value;
        if (p.FollowUpNotes != null) row.FollowUpNotes = p.FollowUpNotes;
        if (p.VisitOutcome != null) row.VisitOutcome = p.VisitOutcome;
        db.SaveChanges();
        return ListHomeVisitations(row.ResidentId).First(x => x.Id == id);
    }

    public IReadOnlyList<InterventionPlanDto> ListInterventionPlans(int? residentId)
    {
        IQueryable<InterventionPlan> q = db.InterventionPlans;
        if (residentId is > 0) q = q.Where(p => p.ResidentId == residentId.Value);

        return q
            .OrderByDescending(p => p.CaseConferenceDate ?? DateOnly.MinValue)
            .ToList()
            .Select(p => new InterventionPlanDto(
                p.PlanId,
                p.ResidentId,
                ResidentCode(p.ResidentId),
                p.PlanCategory,
                p.PlanDescription,
                NullIfEmpty(p.ServicesProvided),
                p.TargetValue,
                p.TargetDate?.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                p.Status,
                p.CaseConferenceDate?.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc),
                p.CreatedAt,
                p.UpdatedAt))
            .ToList();
    }

    public ReportsSummaryDto GetReportsSummary()
    {
        var total = db.Residents.Count();
        var active = db.Residents.Count(r => r.CaseStatus.ToLower() == "active");
        var closed = db.Residents.Count(r => r.CaseStatus.ToLower() == "closed");

        var monetary = db.Donations.Where(d => d.DonationType.ToLower() == "monetary").Sum(d => d.Amount ?? 0m);

        var trends = db.Donations
            .Where(d => d.DonationType.ToLower() == "monetary")
            .AsEnumerable()
            .GroupBy(d => new { d.DonationDate.Year, d.DonationDate.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g => new MonthlyDonationTrendDto(
                $"{g.Key.Year}-{g.Key.Month:D2}",
                g.Sum(x => x.Amount ?? 0m),
                g.Count()))
            .ToList();

        var latestMonth = db.SafehouseMonthlyMetrics
            .AsEnumerable()
            .GroupBy(x => x.SafehouseId)
            .Select(g => g.OrderByDescending(x => x.MonthStart).First())
            .ToList();

        var activeResidentsBySafehouse = db.Residents
            .Where(r => r.CaseStatus.ToLower() == "active")
            .GroupBy(r => r.SafehouseId)
            .Select(g => new { SafehouseId = g.Key, Count = g.Count() })
            .ToDictionary(x => x.SafehouseId, x => x.Count);

        var perf = db.Safehouses
            .Where(s => s.Status.ToLower() == "active")
            .ToList()
            .Select(s =>
            {
                var cap = Math.Max(s.CapacityGirls, 1);
                var lm = latestMonth.FirstOrDefault(x => x.SafehouseId == s.SafehouseId);
                var activeResidents = activeResidentsBySafehouse.GetValueOrDefault(s.SafehouseId, 0);
                return new SafehousePerformanceDto(
                    s.SafehouseId,
                    s.Name,
                    activeResidents,
                    cap,
                    Math.Round(100.0 * s.CurrentOccupancy / cap, 1),
                    lm?.AvgEducationProgress,
                    lm?.AvgHealthScore);
            })
            .OrderBy(x => x.SafehouseId)
            .ToList();

        var eduVals = db.EducationRecords.Where(e => e.ProgressPercent != null).Select(e => e.ProgressPercent!.Value).ToList();
        var eduAvg = eduVals.Count == 0 ? 0 : eduVals.Average();

        var hlVals = db.HealthWellbeingRecords.Where(h => h.GeneralHealthScore != null).Select(h => h.GeneralHealthScore!.Value).ToList();
        var hlAvg = hlVals.Count == 0 ? 0 : hlVals.Average();

        var pillars = CountPillarKeywords();
        var completed = db.Residents.Count(r => (r.ReintegrationStatus ?? "").ToLower() == "completed");

        var highlights = new List<string>
        {
            $"{active} active residents across {perf.Count} safehouses (Supabase).",
            $"Average education progress across records: {eduAvg:F1}%.",
            $"Average general health score: {hlAvg:F2} (scale ~1–5).",
            $"Reintegration completed for {completed} residents.",
        };

        return new ReportsSummaryDto(
            total,
            active,
            closed,
            monetary,
            db.ProcessRecordings.Count(),
            trends,
            perf,
            new ResidentOutcomeMetricsDto(Math.Round(eduAvg, 2), Math.Round(hlAvg, 2), db.EducationRecords.Count(), db.HealthWellbeingRecords.Count()),
            new AarStyleReportDto(total, pillars, highlights));
    }

    public PublicImpactSummaryDto GetPublicImpactSummary()
    {
        var active = db.Residents.Count(r => r.CaseStatus.ToLower() == "active");
        var shCount = db.Safehouses.Count(s => s.Status.ToLower() == "active");

        var eduAvg = db.EducationRecords.Any()
            ? db.EducationRecords.Average(e => e.ProgressPercent ?? 0)
            : 0;
        var hlAvg = db.HealthWellbeingRecords.Any()
            ? db.HealthWellbeingRecords.Average(h => h.GeneralHealthScore ?? 0)
            : 0;

        var lastMonth = new DateOnly(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1).AddMonths(-1);
        var donationsLast = db.Donations
            .Where(d => d.DonationType.ToLower() == "monetary")
            .Where(d => d.DonationDate.Year == lastMonth.Year && d.DonationDate.Month == lastMonth.Month)
            .Sum(d => d.Amount ?? 0m);

        var supporters = db.Supporters.Count();
        var completed = db.Residents.Count(r => (r.ReintegrationStatus ?? "").ToLower() == "completed");
        // Avoid string.IsNullOrWhiteSpace here — EF Core cannot translate it to SQL for Npgsql (runtime 500).
        var denom = Math.Max(
            db.Residents.Count(r => r.ReintegrationStatus != null && r.ReintegrationStatus != ""),
            1);
        var rate = 100.0 * completed / denom;

        return new PublicImpactSummaryDto(
            active,
            shCount,
            Math.Round(eduAvg, 2),
            Math.Round(hlAvg, 2),
            donationsLast,
            supporters,
            Math.Round(rate, 1));
    }

    public IReadOnlyList<PublicImpactSnapshotDto> GetPublishedSnapshots()
    {
        return db.PublicImpactSnapshots
            .Where(s => s.IsPublished)
            .OrderByDescending(s => s.SnapshotDate)
            .Take(24)
            .AsEnumerable()
            .Select(s => new PublicImpactSnapshotDto(
                s.SnapshotId,
                s.SnapshotDate,
                s.Headline,
                s.SummaryText,
                ParsePythonishMetrics(s.MetricPayloadJson ?? ""),
                true))
            .ToList();
    }

    public bool DeleteSupporter(int id)
    {
        var row = db.Supporters.FirstOrDefault(x => x.SupporterId == id);
        if (row is null) return false;
        db.Supporters.Remove(row);
        db.SaveChanges();
        return true;
    }

    public SupporterDto? PatchSupporterFields(int id, IReadOnlyDictionary<string, string?> fields)
    {
        var row = db.Supporters.FirstOrDefault(x => x.SupporterId == id);
        if (row is null) return null;
        foreach (var (k, v) in fields)
        {
            if (v is null) continue;
            switch (k.ToLowerInvariant())
            {
                case "display_name": row.DisplayName = v; break;
                case "email": row.Email = v; break;
                case "region": row.Region = v; break;
                case "status": row.Status = v; break;
                case "supporter_type": row.SupporterType = v; break;
                case "country": row.Country = v; break;
            }
        }
        db.SaveChanges();
        return ListSupporters().FirstOrDefault(x => x.Id == id);
    }

    public bool DeleteDonation(int id)
    {
        var row = db.Donations.FirstOrDefault(x => x.DonationId == id);
        if (row is null) return false;
        db.Donations.Remove(row);
        db.SaveChanges();
        return true;
    }

    public DonationDto? PatchDonationFields(int id, IReadOnlyDictionary<string, string?> fields)
    {
        var row = db.Donations.FirstOrDefault(x => x.DonationId == id);
        if (row is null) return null;
        foreach (var (k, v) in fields)
        {
            if (v is null) continue;
            switch (k.ToLowerInvariant())
            {
                case "donation_type": row.DonationType = v; break;
                case "campaign_name": row.CampaignName = v; break;
                case "currency_code": row.CurrencyCode = v; break;
                case "notes": row.Notes = v; break;
                case "amount":
                    if (decimal.TryParse(v, System.Globalization.NumberStyles.Any, CultureInfo.InvariantCulture, out var amt))
                        row.Amount = amt;
                    break;
            }
        }
        db.SaveChanges();
        return ListDonations(null).FirstOrDefault(x => x.Id == id);
    }

    public DonationAllocationDto CreateAllocation(int donationId, int safehouseId, decimal? amount, string? notes, string? programArea)
    {
        var row = new DonationAllocation
        {
            DonationId = donationId,
            SafehouseId = safehouseId,
            AmountAllocated = amount ?? 0m,
            AllocationNotes = notes,
            ProgramArea = string.IsNullOrWhiteSpace(programArea) ? "General" : programArea.Trim(),
            AllocationDate = DateOnly.FromDateTime(DateTime.UtcNow),
        };
        db.DonationAllocations.Add(row);
        db.SaveChanges();
        return ListAllocations(donationId, null).First(x => x.Id == row.AllocationId);
    }

    public DonationAllocationDto? PatchAllocationFields(int id, IReadOnlyDictionary<string, string?> fields)
    {
        var row = db.DonationAllocations.FirstOrDefault(x => x.AllocationId == id);
        if (row is null) return null;
        foreach (var (k, v) in fields)
        {
            if (v is null) continue;
            switch (k.ToLowerInvariant())
            {
                case "program_area": row.ProgramArea = v; break;
                case "allocation_notes": row.AllocationNotes = v; break;
                case "amount_allocated":
                    if (decimal.TryParse(v, System.Globalization.NumberStyles.Any, CultureInfo.InvariantCulture, out var amt))
                        row.AmountAllocated = amt;
                    break;
            }
        }
        db.SaveChanges();
        return ListAllocations(null, null).FirstOrDefault(x => x.Id == id);
    }

    public bool DeleteAllocation(int id)
    {
        var row = db.DonationAllocations.FirstOrDefault(x => x.AllocationId == id);
        if (row is null) return false;
        db.DonationAllocations.Remove(row);
        db.SaveChanges();
        return true;
    }

    public InterventionPlanDto CreateInterventionPlan(int residentId, string planCategory, string planDescription, string? status,
        DateOnly? targetDate, DateOnly? caseConferenceDate, double? targetValue, string? servicesProvided)
    {
        var now = DateTime.UtcNow;
        var row = new InterventionPlan
        {
            ResidentId = residentId,
            PlanCategory = planCategory,
            PlanDescription = planDescription,
            ServicesProvided = servicesProvided,
            TargetValue = targetValue,
            Status = string.IsNullOrWhiteSpace(status) ? "In Progress" : status,
            TargetDate = targetDate,
            CaseConferenceDate = caseConferenceDate,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.InterventionPlans.Add(row);
        db.SaveChanges();
        return ListInterventionPlans(residentId).First(x => x.Id == row.PlanId);
    }

    public InterventionPlanDto? PatchInterventionPlan(int id, PatchInterventionPlanDto p)
    {
        var row = db.InterventionPlans.FirstOrDefault(x => x.PlanId == id);
        if (row is null) return null;
        if (p.PlanCategory != null) row.PlanCategory = p.PlanCategory;
        if (p.PlanDescription != null) row.PlanDescription = p.PlanDescription;
        if (p.ServicesProvided != null) row.ServicesProvided = p.ServicesProvided;
        if (p.TargetValue.HasValue) row.TargetValue = p.TargetValue;
        if (p.TargetDate != null)
        {
            if (string.IsNullOrWhiteSpace(p.TargetDate)) row.TargetDate = null;
            else if (DateOnly.TryParse(p.TargetDate, out var td)) row.TargetDate = td;
        }
        if (p.Status != null) row.Status = p.Status;
        if (p.CaseConferenceDate != null)
        {
            if (string.IsNullOrWhiteSpace(p.CaseConferenceDate)) row.CaseConferenceDate = null;
            else if (DateOnly.TryParse(p.CaseConferenceDate, out var cd)) row.CaseConferenceDate = cd;
        }
        row.UpdatedAt = DateTime.UtcNow;
        db.SaveChanges();
        return ListInterventionPlans(row.ResidentId).First(x => x.Id == id);
    }

    public bool DeleteInterventionPlan(int id)
    {
        var row = db.InterventionPlans.FirstOrDefault(x => x.PlanId == id);
        if (row is null) return false;
        db.InterventionPlans.Remove(row);
        db.SaveChanges();
        return true;
    }

    public bool DeleteResident(int id)
    {
        var row = db.Residents.FirstOrDefault(x => x.ResidentId == id);
        if (row is null) return false;
        db.Residents.Remove(row);
        db.SaveChanges();
        return true;
    }

    public bool DeleteProcessRecording(int id)
    {
        var row = db.ProcessRecordings.FirstOrDefault(x => x.RecordingId == id);
        if (row is null) return false;
        db.ProcessRecordings.Remove(row);
        db.SaveChanges();
        return true;
    }

    public bool DeleteHomeVisitation(int id)
    {
        var row = db.HomeVisitations.FirstOrDefault(x => x.VisitationId == id);
        if (row is null) return false;
        db.HomeVisitations.Remove(row);
        db.SaveChanges();
        return true;
    }

    public IReadOnlyList<EducationRecordDto> ListEducationRecords(int? residentId)
    {
        IQueryable<EducationRecord> q = db.EducationRecords;
        if (residentId is > 0) q = q.Where(e => e.ResidentId == residentId.Value);
        return q
            .OrderByDescending(e => e.RecordDate)
            .Select(e => new EducationRecordDto(
                e.EducationRecordId,
                e.ResidentId,
                e.RecordDate.ToString("yyyy-MM-dd"),
                e.ProgressPercent,
                NullIfEmpty(e.ExtendedJson)))
            .ToList();
    }

    public EducationRecordDto CreateEducationRecord(int residentId, DateOnly recordDate, double? progressPercent, string? extendedJson = null)
    {
        var row = new EducationRecord
        {
            ResidentId = residentId,
            RecordDate = recordDate,
            ProgressPercent = progressPercent,
            ExtendedJson = string.IsNullOrWhiteSpace(extendedJson) ? null : extendedJson.Trim(),
        };
        db.EducationRecords.Add(row);
        db.SaveChanges();
        return new EducationRecordDto(row.EducationRecordId, row.ResidentId, row.RecordDate.ToString("yyyy-MM-dd"), row.ProgressPercent, NullIfEmpty(row.ExtendedJson));
    }

    public EducationRecordDto? PatchEducationRecord(int id, double? progressPercent, DateOnly? recordDate, string? extendedJson = null)
    {
        var row = db.EducationRecords.FirstOrDefault(x => x.EducationRecordId == id);
        if (row is null) return null;
        if (progressPercent.HasValue) row.ProgressPercent = progressPercent.Value;
        if (recordDate.HasValue) row.RecordDate = recordDate.Value;
        if (extendedJson != null) row.ExtendedJson = string.IsNullOrWhiteSpace(extendedJson) ? null : extendedJson.Trim();
        db.SaveChanges();
        return new EducationRecordDto(row.EducationRecordId, row.ResidentId, row.RecordDate.ToString("yyyy-MM-dd"), row.ProgressPercent, NullIfEmpty(row.ExtendedJson));
    }

    public IReadOnlyList<HealthRecordDto> ListHealthRecords(int? residentId)
    {
        IQueryable<HealthWellbeingRecord> q = db.HealthWellbeingRecords;
        if (residentId is > 0) q = q.Where(h => h.ResidentId == residentId.Value);
        return q
            .OrderByDescending(h => h.RecordDate)
            .Select(h => new HealthRecordDto(
                h.HealthRecordId,
                h.ResidentId,
                h.RecordDate.ToString("yyyy-MM-dd"),
                h.GeneralHealthScore,
                NullIfEmpty(h.ExtendedJson)))
            .ToList();
    }

    public HealthRecordDto CreateHealthRecord(int residentId, DateOnly recordDate, double? healthScore, string? extendedJson = null)
    {
        var row = new HealthWellbeingRecord
        {
            ResidentId = residentId,
            RecordDate = recordDate,
            GeneralHealthScore = healthScore,
            ExtendedJson = string.IsNullOrWhiteSpace(extendedJson) ? null : extendedJson.Trim(),
        };
        db.HealthWellbeingRecords.Add(row);
        db.SaveChanges();
        return new HealthRecordDto(row.HealthRecordId, row.ResidentId, row.RecordDate.ToString("yyyy-MM-dd"), row.GeneralHealthScore, NullIfEmpty(row.ExtendedJson));
    }

    public HealthRecordDto? PatchHealthRecord(int id, double? healthScore, DateOnly? recordDate, string? extendedJson = null)
    {
        var row = db.HealthWellbeingRecords.FirstOrDefault(x => x.HealthRecordId == id);
        if (row is null) return null;
        if (healthScore.HasValue) row.GeneralHealthScore = healthScore.Value;
        if (recordDate.HasValue) row.RecordDate = recordDate.Value;
        if (extendedJson != null) row.ExtendedJson = string.IsNullOrWhiteSpace(extendedJson) ? null : extendedJson.Trim();
        db.SaveChanges();
        return new HealthRecordDto(row.HealthRecordId, row.ResidentId, row.RecordDate.ToString("yyyy-MM-dd"), row.GeneralHealthScore, NullIfEmpty(row.ExtendedJson));
    }

    // ── Incident Reports ──────────────────────────────────────────────────────

    private static IncidentReportDto ToIncidentDto(DataAccess.Entities.IncidentReport r) =>
        new(r.IncidentId, r.ResidentId, r.SafehouseId,
            r.IncidentDate.ToString("yyyy-MM-dd"),
            r.IncidentType, r.Severity, r.Description, r.ResponseTaken,
            r.Resolved,
            r.ResolutionDate?.ToString("yyyy-MM-dd"),
            r.ReportedBy, r.FollowUpRequired);

    public IReadOnlyList<IncidentReportDto> ListIncidentReports(int? residentId)
    {
        IQueryable<DataAccess.Entities.IncidentReport> q = db.IncidentReports;
        if (residentId is > 0) q = q.Where(x => x.ResidentId == residentId.Value);
        return q.OrderByDescending(x => x.IncidentDate).Select(x => ToIncidentDto(x)).ToList();
    }

    public IncidentReportDto CreateIncidentReport(int residentId, int? safehouseId, DateOnly incidentDate,
        string incidentType, string severity, string? description, string? responseTaken,
        bool resolved, DateOnly? resolutionDate, string? reportedBy, bool followUpRequired)
    {
        var row = new DataAccess.Entities.IncidentReport
        {
            ResidentId      = residentId,
            SafehouseId     = safehouseId,
            IncidentDate    = incidentDate,
            IncidentType    = incidentType,
            Severity        = severity,
            Description     = description,
            ResponseTaken   = responseTaken,
            Resolved        = resolved,
            ResolutionDate  = resolutionDate,
            ReportedBy      = reportedBy,
            FollowUpRequired = followUpRequired,
        };
        db.IncidentReports.Add(row);
        db.SaveChanges();
        return ToIncidentDto(row);
    }

    public IncidentReportDto? PatchIncidentReport(int id, IReadOnlyDictionary<string, string?> fields)
    {
        var row = db.IncidentReports.FirstOrDefault(x => x.IncidentId == id);
        if (row is null) return null;

        if (fields.TryGetValue("incident_type", out var it) && it is not null)   row.IncidentType    = it;
        if (fields.TryGetValue("severity",      out var sv) && sv is not null)   row.Severity        = sv;
        if (fields.TryGetValue("description",   out var desc))                   row.Description     = desc;
        if (fields.TryGetValue("response_taken", out var rt))                    row.ResponseTaken   = rt;
        if (fields.TryGetValue("reported_by",   out var rb))                     row.ReportedBy      = rb;
        if (fields.TryGetValue("resolved",      out var res) && res is not null) row.Resolved        = res.Equals("true",  StringComparison.OrdinalIgnoreCase) || res == "1";
        if (fields.TryGetValue("follow_up_required", out var fu) && fu is not null) row.FollowUpRequired = fu.Equals("true", StringComparison.OrdinalIgnoreCase) || fu == "1";
        if (fields.TryGetValue("incident_date", out var idate) && DateOnly.TryParse(idate, out var id2)) row.IncidentDate = id2;
        if (fields.TryGetValue("resolution_date", out var rdate))
            row.ResolutionDate = !string.IsNullOrWhiteSpace(rdate) && DateOnly.TryParse(rdate, out var rd) ? rd : null;

        db.SaveChanges();
        return ToIncidentDto(row);
    }

    public bool DeleteIncidentReport(int id)
    {
        var row = db.IncidentReports.FirstOrDefault(x => x.IncidentId == id);
        if (row is null) return false;
        db.IncidentReports.Remove(row);
        db.SaveChanges();
        return true;
    }

    private ServicePillarCountsDto CountPillarKeywords()
    {
        var caring = 0;
        var healing = 0;
        var teaching = 0;
        foreach (var iv in db.ProcessRecordings.Select(p => p.InterventionsApplied).AsEnumerable())
        {
            var s = iv ?? "";
            if (s.Contains("Caring", StringComparison.OrdinalIgnoreCase)) caring++;
            if (s.Contains("Healing", StringComparison.OrdinalIgnoreCase)) healing++;
            if (s.Contains("Teaching", StringComparison.OrdinalIgnoreCase)) teaching++;
        }

        return new ServicePillarCountsDto(caring, healing, teaching);
    }

    private string ResidentCode(int residentId)
    {
        var r = db.Residents.FirstOrDefault(x => x.ResidentId == residentId);
        return r is null ? $"R-{residentId}" : r.InternalCode;
    }

    private static string? NullIfEmpty(string? s) => string.IsNullOrWhiteSpace(s) ? null : s;

    private IReadOnlyDictionary<string, string>? ReadRowAsStrings(string table, string idColumn, int id)
    {
        using var cmd = db.Database.GetDbConnection().CreateCommand();
        if (cmd.Connection!.State != ConnectionState.Open) cmd.Connection.Open();
        cmd.CommandText = $"select * from public.{table} where {idColumn} = @id limit 1";
        var p = cmd.CreateParameter();
        p.ParameterName = "id";
        p.Value = id;
        cmd.Parameters.Add(p);
        using var reader = cmd.ExecuteReader();
        if (!reader.Read()) return null;
        var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < reader.FieldCount; i++)
        {
            var name = reader.GetName(i);
            if (string.IsNullOrWhiteSpace(name)) continue;
            var val = reader.IsDBNull(i) ? "" : Convert.ToString(reader.GetValue(i), CultureInfo.InvariantCulture) ?? "";
            dict[name] = val;
        }
        return dict;
    }

    private HashSet<string> GetColumns(string table)
    {
        return ColumnCache.GetOrAdd(table, _ =>
        {
            using var cmd = db.Database.GetDbConnection().CreateCommand();
            if (cmd.Connection!.State != ConnectionState.Open) cmd.Connection.Open();
            cmd.CommandText =
                "select column_name from information_schema.columns where table_schema = 'public' and table_name = @t";
            var p = cmd.CreateParameter();
            p.ParameterName = "t";
            p.Value = table;
            cmd.Parameters.Add(p);
            using var reader = cmd.ExecuteReader();
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            while (reader.Read())
                set.Add(reader.GetString(0));
            return set;
        });
    }

    private static IReadOnlyDictionary<string, string?> ParsePythonishMetrics(string raw)
    {
        var d = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(raw)) return d;
        void Num(string key, string pattern)
        {
            var m = Regex.Match(raw, pattern, RegexOptions.IgnoreCase);
            if (m.Success && double.TryParse(m.Groups[1].Value, NumberStyles.Any, CultureInfo.InvariantCulture, out _))
                d[key] = m.Groups[1].Value;
        }
        void Str(string key, string pattern)
        {
            var m = Regex.Match(raw, pattern, RegexOptions.IgnoreCase);
            if (m.Success) d[key] = m.Groups[1].Value;
        }
        Str("month", @"'month':\s*'([^']*)'");
        Num("avg_health_score", @"'avg_health_score':\s*([\d.]+)");
        Num("avg_education_progress", @"'avg_education_progress':\s*([\d.]+)");
        Num("total_residents", @"'total_residents':\s*([\d]+)");
        Num("donations_total_for_month", @"'donations_total_for_month':\s*([\d.]+)");
        return d;
    }
}
