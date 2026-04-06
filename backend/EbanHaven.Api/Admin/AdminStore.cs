namespace EbanHaven.Api.Admin;

public sealed class AdminStore
{
    private readonly object _lock = new();
    private readonly List<DonorDto> _donors = new();
    private readonly List<CaseDto> _cases = new();
    private readonly List<VisitationDto> _visitations = new();
    private readonly List<ProcessRecordingDto> _recordings = new();

    public AdminStore()
    {
        Seed();
    }

    private void Seed()
    {
        var d1 = Guid.NewGuid();
        var d2 = Guid.NewGuid();
        _donors.AddRange([
            new DonorDto(d1, "Anonymous Supporter", 250m, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5)), "General fund"),
            new DonorDto(d2, "Community Foundation", 5000m, DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30)), "Education bridge"),
        ]);

        var c1 = Guid.NewGuid();
        var c2 = Guid.NewGuid();
        _cases.AddRange([
            new CaseDto(c1, "EH-2026-0142", "Active", DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-60)), "Intake complete; counseling phase"),
            new CaseDto(c2, "EH-2026-0138", "Reintegration", DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-120)), "Family reunification planning"),
        ]);

        _visitations.AddRange([
            new VisitationDto(Guid.NewGuid(), c1, "Social Worker A.", DateTime.UtcNow.AddDays(2), "Scheduled"),
            new VisitationDto(Guid.NewGuid(), c2, "Family liaison", DateTime.UtcNow.AddDays(-1), "Completed"),
        ]);

        _recordings.AddRange([
            new ProcessRecordingDto(Guid.NewGuid(), c1, DateTime.UtcNow.AddDays(-3), "M. Santos", "Weekly progress — resident engaged in group therapy."),
        ]);
    }

    public DashboardSummaryDto GetDashboard()
    {
        lock (_lock)
        {
            var weekStart = DateTime.UtcNow.Date.AddDays(-(int)DateTime.UtcNow.DayOfWeek);
            var visitThisWeek = _visitations.Count(v => v.ScheduledAt >= weekStart);
            return new DashboardSummaryDto(
                _donors.Count,
                _donors.Sum(d => d.Amount),
                _cases.Count(c => c.Status.Equals("Active", StringComparison.OrdinalIgnoreCase)),
                visitThisWeek,
                _recordings.Count);
        }
    }

    public IReadOnlyList<DonorDto> ListDonors()
    {
        lock (_lock)
            return _donors.OrderByDescending(d => d.Date).ToList();
    }

    public DonorDto AddDonor(string donorName, decimal amount, DateOnly date, string? note)
    {
        var dto = new DonorDto(Guid.NewGuid(), donorName, amount, date, note);
        lock (_lock)
            _donors.Add(dto);
        return dto;
    }

    public IReadOnlyList<CaseDto> ListCases()
    {
        lock (_lock)
            return _cases.OrderByDescending(c => c.Opened).ToList();
    }

    public CaseDto AddCase(string referenceCode, string status, string? summary)
    {
        var dto = new CaseDto(Guid.NewGuid(), referenceCode, status, DateOnly.FromDateTime(DateTime.UtcNow), summary);
        lock (_lock)
            _cases.Add(dto);
        return dto;
    }

    public CaseDto? UpdateCaseStatus(Guid id, string status)
    {
        lock (_lock)
        {
            var i = _cases.FindIndex(c => c.Id == id);
            if (i < 0) return null;
            var c = _cases[i];
            var updated = c with { Status = status };
            _cases[i] = updated;
            return updated;
        }
    }

    public IReadOnlyList<VisitationDto> ListVisitations()
    {
        lock (_lock)
            return _visitations.OrderByDescending(v => v.ScheduledAt).ToList();
    }

    public VisitationDto AddVisitation(Guid? caseId, string visitorName, DateTime scheduledAt, string status)
    {
        var dto = new VisitationDto(Guid.NewGuid(), caseId, visitorName, scheduledAt, status);
        lock (_lock)
            _visitations.Add(dto);
        return dto;
    }

    public IReadOnlyList<ProcessRecordingDto> ListRecordings()
    {
        lock (_lock)
            return _recordings.OrderByDescending(r => r.RecordedAt).ToList();
    }

    public ProcessRecordingDto AddRecording(Guid caseId, DateTime recordedAt, string therapist, string summary)
    {
        var dto = new ProcessRecordingDto(Guid.NewGuid(), caseId, recordedAt, therapist, summary);
        lock (_lock)
            _recordings.Add(dto);
        return dto;
    }

    public ReportsSummaryDto GetReportsSummary()
    {
        lock (_lock)
        {
            var byStatus = _cases.GroupBy(c => c.Status).ToDictionary(g => g.Key, g => g.Count());
            return new ReportsSummaryDto(
                _cases.Count,
                byStatus.GetValueOrDefault("Active", 0),
                byStatus.GetValueOrDefault("Reintegration", 0),
                _donors.Sum(d => d.Amount),
                _recordings.Count);
        }
    }
}

public sealed record DonorDto(Guid Id, string DonorName, decimal Amount, DateOnly Date, string? Note);

public sealed record CaseDto(Guid Id, string ReferenceCode, string Status, DateOnly Opened, string? Summary);

public sealed record VisitationDto(Guid Id, Guid? CaseId, string VisitorName, DateTime ScheduledAt, string Status);

public sealed record ProcessRecordingDto(Guid Id, Guid CaseId, DateTime RecordedAt, string Therapist, string Summary);

public sealed record DashboardSummaryDto(
    int DonorCount,
    decimal TotalContributions,
    int ActiveCases,
    int VisitationsThisWeek,
    int ProcessRecordingsCount);

public sealed record ReportsSummaryDto(
    int TotalCases,
    int ActiveCases,
    int ReintegrationCases,
    decimal TotalContributions,
    int ProcessRecordingsCount);

public sealed record CreateDonorRequest(string DonorName, decimal Amount, DateOnly? Date, string? Note);

public sealed record CreateCaseRequest(string ReferenceCode, string Status, string? Summary);

public sealed record UpdateCaseStatusRequest(string Status);

public sealed record CreateVisitationRequest(Guid? CaseId, string VisitorName, DateTime ScheduledAt, string Status);

public sealed record CreateRecordingRequest(Guid CaseId, DateTime? RecordedAt, string Therapist, string Summary);
