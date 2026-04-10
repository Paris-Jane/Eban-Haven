using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;

namespace EbanHaven.Api.Lighthouse;

public sealed class LighthouseDataStore
{
    private readonly object _lock = new();
    private readonly string _root;
    private List<Dictionary<string, string>> _residents = [];
    private List<Dictionary<string, string>> _supporters = [];
    private List<Dictionary<string, string>> _donations = [];
    private List<Dictionary<string, string>> _allocations = [];
    private List<Dictionary<string, string>> _safehouses = [];
    private List<Dictionary<string, string>> _processRecordings = [];
    private List<Dictionary<string, string>> _homeVisitations = [];
    private List<Dictionary<string, string>> _interventionPlans = [];
    private List<Dictionary<string, string>> _educationRecords = [];
    private List<Dictionary<string, string>> _healthRecords = [];
    private List<Dictionary<string, string>> _snapshots = [];
    private List<Dictionary<string, string>> _safehouseMonthly = [];

    public LighthouseDataStore(IWebHostEnvironment env)
    {
        _root = Path.Combine(env.ContentRootPath, "Data", "lighthouse");
        ReloadFromDisk();
    }

    public void ReloadFromDisk()
    {
        lock (_lock)
        {
            _residents = Read("residents.csv");
            _supporters = Read("supporters.csv");
            _donations = Read("donations.csv");
            _allocations = Read("donation_allocations.csv");
            _safehouses = Read("safehouses.csv");
            _processRecordings = Read("process_recordings.csv");
            _homeVisitations = Read("home_visitations.csv");
            _interventionPlans = Read("intervention_plans.csv");
            _educationRecords = Read("education_records.csv");
            _healthRecords = Read("health_wellbeing_records.csv");
            _snapshots = Read("public_impact_snapshots.csv");
            _safehouseMonthly = Read("safehouse_monthly_metrics.csv");
        }
    }

    private List<Dictionary<string, string>> Read(string file) =>
        CsvTableReader.ReadTable(Path.Combine(_root, file));

    private static int GetInt(Dictionary<string, string> row, string key, int fallback = 0)
    {
        return row.TryGetValue(key, out var s) && int.TryParse(s.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var v)
            ? v
            : fallback;
    }

    private static bool GetBool(Dictionary<string, string> row, string key) =>
        row.TryGetValue(key, out var s) &&
        s.Equals("True", StringComparison.OrdinalIgnoreCase);

    private static string GetStr(Dictionary<string, string> row, string key) =>
        row.TryGetValue(key, out var s) ? s : string.Empty;

    private static DateTime? ParseDateTime(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var u))
            return u;
        if (DateOnly.TryParse(s, CultureInfo.InvariantCulture, out var d))
            return d.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        return null;
    }

    private string? SafehouseName(int id)
    {
        var sh = _safehouses.FirstOrDefault(x => GetInt(x, "safehouse_id") == id);
        return sh is null ? null : GetStr(sh, "name");
    }

    private string ResidentCode(int residentId)
    {
        var r = _residents.FirstOrDefault(x => GetInt(x, "resident_id") == residentId);
        return r is null ? $"R-{residentId}" : GetStr(r, "internal_code");
    }

    private string SupporterName(int supporterId)
    {
        var s = _supporters.FirstOrDefault(x => GetInt(x, "supporter_id") == supporterId);
        if (s is null) return $"Supporter #{supporterId}";
        var d = GetStr(s, "display_name");
        if (!string.IsNullOrWhiteSpace(d)) return d;
        var fn = GetStr(s, "first_name");
        var ln = GetStr(s, "last_name");
        return $"{fn} {ln}".Trim();
    }

    public AdminDashboardDto GetAdminDashboard()
    {
        lock (_lock)
        {
            var today = DateTime.UtcNow.Date;
            var weekStart = today.AddDays(-(int)today.DayOfWeek);
            var activeResidents = _residents.Count(r =>
                GetStr(r, "case_status").Equals("Active", StringComparison.OrdinalIgnoreCase));

            var safehouseRows = _safehouses
                .Where(s => GetStr(s, "status").Equals("Active", StringComparison.OrdinalIgnoreCase))
                .Select(s => new SafehouseOccupancyDto(
                    GetInt(s, "safehouse_id"),
                    GetStr(s, "safehouse_code"),
                    GetStr(s, "name"),
                    GetStr(s, "region"),
                    GetInt(s, "current_occupancy"),
                    GetInt(s, "capacity_girls")))
                .OrderBy(x => x.Id)
                .ToList();

            var recentDonations = _donations
                .Select(d => new
                {
                    Row = d,
                    Dt = ParseDateTime(GetStr(d, "donation_date")) ?? DateTime.MinValue,
                })
                .OrderByDescending(x => x.Dt)
                .Take(8)
                .Select(x => new RecentDonationRowDto(
                    GetInt(x.Row, "donation_id"),
                    SupporterName(GetInt(x.Row, "supporter_id")),
                    GetStr(x.Row, "donation_type"),
                    decimal.TryParse(GetStr(x.Row, "amount"), NumberStyles.Any, CultureInfo.InvariantCulture, out var amt) ? amt : null,
                    string.IsNullOrWhiteSpace(GetStr(x.Row, "currency_code")) ? null : GetStr(x.Row, "currency_code"),
                    x.Dt,
                    string.IsNullOrWhiteSpace(GetStr(x.Row, "campaign_name")) ? null : GetStr(x.Row, "campaign_name")))
                .ToList();

            var upcomingConferences = _interventionPlans
                .Select(p => new
                {
                    Row = p,
                    Dt = ParseDateTime(GetStr(p, "case_conference_date")),
                })
                .Where(x => x.Dt.HasValue && x.Dt.Value.Date >= today)
                .OrderBy(x => x.Dt)
                .Take(12)
                .Select(x => new UpcomingConferenceDto(
                    GetInt(x.Row, "plan_id"),
                    GetInt(x.Row, "resident_id"),
                    ResidentCode(GetInt(x.Row, "resident_id")),
                    GetStr(x.Row, "plan_category"),
                    x.Dt,
                    GetStr(x.Row, "status"),
                    string.IsNullOrWhiteSpace(GetStr(x.Row, "plan_description")) ? null : GetStr(x.Row, "plan_description")))
                .ToList();

            var thirtyDaysAgo = today.AddDays(-30);
            var monetary30 = _donations
                .Where(d => GetStr(d, "donation_type").Equals("Monetary", StringComparison.OrdinalIgnoreCase))
                .Where(d =>
                {
                    var dt = ParseDateTime(GetStr(d, "donation_date"));
                    return dt.HasValue && dt.Value.Date >= thirtyDaysAgo;
                })
                .Sum(d => decimal.TryParse(GetStr(d, "amount"), NumberStyles.Any, CultureInfo.InvariantCulture, out var a) ? a : 0m);

            var visit90 = _homeVisitations.Count(v =>
            {
                var dt = ParseDateTime(GetStr(v, "visit_date"));
                return dt.HasValue && dt.Value.Date >= today.AddDays(-90);
            });

            var completed = _residents.Count(r =>
                GetStr(r, "reintegration_status").Equals("Completed", StringComparison.OrdinalIgnoreCase));
            var inProg = _residents.Count(r =>
                GetStr(r, "reintegration_status").Equals("In Progress", StringComparison.OrdinalIgnoreCase));
            var denom = Math.Max(_residents.Count(r => !string.IsNullOrWhiteSpace(GetStr(r, "reintegration_status"))), 1);
            var rate = 100.0 * completed / denom;

            return new AdminDashboardDto(
                activeResidents,
                safehouseRows,
                recentDonations,
                upcomingConferences,
                monetary30,
                _processRecordings.Count,
                visit90,
                new ReintegrationKpiDto(completed, inProg, Math.Round(rate, 1)));
        }
    }

    public IReadOnlyList<ResidentSummaryDto> ListResidents(
        string? status,
        int? safehouseId,
        string? category,
        string? search)
    {
        lock (_lock)
        {
            IEnumerable<Dictionary<string, string>> q = _residents;
            if (!string.IsNullOrWhiteSpace(status))
                q = q.Where(r => GetStr(r, "case_status").Equals(status.Trim(), StringComparison.OrdinalIgnoreCase));
            if (safehouseId is > 0)
                q = q.Where(r => GetInt(r, "safehouse_id") == safehouseId.Value);
            if (!string.IsNullOrWhiteSpace(category))
                q = q.Where(r => GetStr(r, "case_category").Contains(category.Trim(), StringComparison.OrdinalIgnoreCase));
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                q = q.Where(r =>
                    GetStr(r, "internal_code").Contains(s, StringComparison.OrdinalIgnoreCase) ||
                    GetStr(r, "case_control_no").Contains(s, StringComparison.OrdinalIgnoreCase) ||
                    GetStr(r, "assigned_social_worker").Contains(s, StringComparison.OrdinalIgnoreCase));
            }

            return q.Select(r => new ResidentSummaryDto(
                    GetInt(r, "resident_id"),
                    GetStr(r, "case_control_no"),
                    GetStr(r, "internal_code"),
                    GetInt(r, "safehouse_id"),
                    SafehouseName(GetInt(r, "safehouse_id")),
                    GetStr(r, "case_status"),
                    GetStr(r, "case_category"),
                    GetStr(r, "sex"),
                    string.IsNullOrWhiteSpace(GetStr(r, "assigned_social_worker")) ? null : GetStr(r, "assigned_social_worker"),
                    string.IsNullOrWhiteSpace(GetStr(r, "date_of_admission")) ? null : GetStr(r, "date_of_admission"),
                    string.IsNullOrWhiteSpace(GetStr(r, "reintegration_status")) ? null : GetStr(r, "reintegration_status"),
                    string.IsNullOrWhiteSpace(GetStr(r, "reintegration_type")) ? null : GetStr(r, "reintegration_type"),
                    string.IsNullOrWhiteSpace(GetStr(r, "present_age")) ? null : GetStr(r, "present_age"),
                    string.IsNullOrWhiteSpace(GetStr(r, "length_of_stay")) ? null : GetStr(r, "length_of_stay"),
                    string.IsNullOrWhiteSpace(GetStr(r, "current_risk_level")) ? null : GetStr(r, "current_risk_level")))
                .OrderByDescending(x => x.Id)
                .ToList();
        }
    }

    public ResidentDetailDto? GetResident(int id)
    {
        lock (_lock)
        {
            var r = _residents.FirstOrDefault(x => GetInt(x, "resident_id") == id);
            if (r is null) return null;
            var copy = new Dictionary<string, string>(r, StringComparer.OrdinalIgnoreCase);
            return new ResidentDetailDto(id, copy);
        }
    }

    public bool UpdateResident(int id, IReadOnlyDictionary<string, string?> patch)
    {
        lock (_lock)
        {
            var r = _residents.FirstOrDefault(x => GetInt(x, "resident_id") == id);
            if (r is null) return false;
            foreach (var (k, v) in patch)
            {
                if (v is null) continue;
                r[k] = v;
            }
            return true;
        }
    }

    public ResidentSummaryDto? UpdateResidentStatus(int id, string caseStatus)
    {
        lock (_lock)
        {
            var r = _residents.FirstOrDefault(x => GetInt(x, "resident_id") == id);
            if (r is null) return null;
            r["case_status"] = caseStatus;
            return ListResidents(null, null, null, null).FirstOrDefault(x => x.Id == id);
        }
    }

    public ResidentSummaryDto CreateResident(string? internalCode, string caseStatus, string? caseCategory)
    {
        lock (_lock)
        {
            var next = _residents.Count == 0 ? 1 : _residents.Max(x => GetInt(x, "resident_id")) + 1;
            var template = _residents.FirstOrDefault() ?? throw new InvalidOperationException("No resident template.");
            var row = new Dictionary<string, string>(template, StringComparer.OrdinalIgnoreCase);
            foreach (var k in row.Keys.ToList())
                row[k] = string.Empty;
            row["resident_id"] = next.ToString(CultureInfo.InvariantCulture);
            row["case_control_no"] = $"C{next:D4}";
            row["internal_code"] = string.IsNullOrWhiteSpace(internalCode) ? $"R-{next:D4}" : internalCode.Trim();
            row["safehouse_id"] = "1";
            row["case_status"] = caseStatus;
            row["case_category"] = string.IsNullOrWhiteSpace(caseCategory) ? "Surrendered" : caseCategory!;
            row["sex"] = "F";
            row["date_of_birth"] = "2010-01-01";
            row["birth_status"] = "Marital";
            row["place_of_birth"] = "Manila";
            row["religion"] = "Unspecified";
            row["date_of_admission"] = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            row["assigned_social_worker"] = "SW-01";
            row["created_at"] = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
            _residents.Add(row);
            return ListResidents(null, null, null, null).First(x => x.Id == next);
        }
    }

    public IReadOnlyList<SupporterDto> ListSupporters()
    {
        lock (_lock)
        {
            return _supporters
                .OrderBy(s => GetInt(s, "supporter_id"))
                .Select(s => new SupporterDto(
                    GetInt(s, "supporter_id"),
                    GetStr(s, "supporter_type"),
                    GetStr(s, "display_name"),
                    string.IsNullOrWhiteSpace(GetStr(s, "organization_name")) ? null : GetStr(s, "organization_name"),
                    string.IsNullOrWhiteSpace(GetStr(s, "first_name")) ? null : GetStr(s, "first_name"),
                    string.IsNullOrWhiteSpace(GetStr(s, "last_name")) ? null : GetStr(s, "last_name"),
                    string.IsNullOrWhiteSpace(GetStr(s, "region")) ? null : GetStr(s, "region"),
                    string.IsNullOrWhiteSpace(GetStr(s, "country")) ? null : GetStr(s, "country"),
                    string.IsNullOrWhiteSpace(GetStr(s, "email")) ? null : GetStr(s, "email"),
                    string.IsNullOrWhiteSpace(GetStr(s, "phone")) ? null : GetStr(s, "phone"),
                    GetStr(s, "status"),
                    string.IsNullOrWhiteSpace(GetStr(s, "first_donation_date")) ? null : GetStr(s, "first_donation_date"),
                    string.IsNullOrWhiteSpace(GetStr(s, "acquisition_channel")) ? null : GetStr(s, "acquisition_channel"),
                    string.IsNullOrWhiteSpace(GetStr(s, "relationship_type")) ? null : GetStr(s, "relationship_type")))
                .ToList();
        }
    }

    public SupporterDto? UpdateSupporter(int id, string? status, string? supporterType)
    {
        lock (_lock)
        {
            var s = _supporters.FirstOrDefault(x => GetInt(x, "supporter_id") == id);
            if (s is null) return null;
            if (!string.IsNullOrWhiteSpace(status)) s["status"] = status.Trim();
            if (!string.IsNullOrWhiteSpace(supporterType)) s["supporter_type"] = supporterType.Trim();
            return ListSupporters().First(x => x.Id == id);
        }
    }

    public SupporterDto CreateSupporter(
        string supporterType,
        string displayName,
        string? email,
        string? region,
        string status)
    {
        lock (_lock)
        {
            var next = _supporters.Max(x => GetInt(x, "supporter_id")) + 1;
            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["supporter_id"] = next.ToString(CultureInfo.InvariantCulture),
                ["supporter_type"] = supporterType,
                ["display_name"] = displayName,
                ["organization_name"] = string.Empty,
                ["first_name"] = string.Empty,
                ["last_name"] = string.Empty,
                ["relationship_type"] = "Local",
                ["region"] = region ?? string.Empty,
                ["country"] = "Philippines",
                ["email"] = email ?? string.Empty,
                ["phone"] = string.Empty,
                ["status"] = status,
                ["created_at"] = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
                ["first_donation_date"] = string.Empty,
                ["acquisition_channel"] = "Website",
            };
            _supporters.Add(row);
            return ListSupporters().First(x => x.Id == next);
        }
    }

    public bool DeleteSupporter(int id)
    {
        lock (_lock)
        {
            var supporterRow = _supporters.FirstOrDefault(x => GetInt(x, "supporter_id") == id);
            if (supporterRow is null) return false;
            var donationIds = _donations
                .Where(d => GetInt(d, "supporter_id") == id)
                .Select(d => GetInt(d, "donation_id"))
                .ToHashSet();
            if (donationIds.Count > 0)
            {
                _allocations.RemoveAll(a => donationIds.Contains(GetInt(a, "donation_id")));
                _donations.RemoveAll(d => GetInt(d, "supporter_id") == id);
            }
            _supporters.Remove(supporterRow);
            return true;
        }
    }

    public IReadOnlyList<DonationDto> ListDonations(int? supporterId)
    {
        lock (_lock)
        {
            IEnumerable<Dictionary<string, string>> q = _donations;
            if (supporterId is > 0)
                q = q.Where(d => GetInt(d, "supporter_id") == supporterId.Value);
            return q
                .Select(d =>
                {
                    var dt = ParseDateTime(GetStr(d, "donation_date")) ?? DateTime.MinValue;
                    return new DonationDto(
                        GetInt(d, "donation_id"),
                        GetInt(d, "supporter_id"),
                        SupporterName(GetInt(d, "supporter_id")),
                        GetStr(d, "donation_type"),
                        dt,
                        GetBool(d, "is_recurring"),
                        string.IsNullOrWhiteSpace(GetStr(d, "campaign_name")) ? null : GetStr(d, "campaign_name"),
                        string.IsNullOrWhiteSpace(GetStr(d, "channel_source")) ? null : GetStr(d, "channel_source"),
                        string.IsNullOrWhiteSpace(GetStr(d, "currency_code")) ? null : GetStr(d, "currency_code"),
                        decimal.TryParse(GetStr(d, "amount"), NumberStyles.Any, CultureInfo.InvariantCulture, out var a) ? a : null,
                        decimal.TryParse(GetStr(d, "estimated_value"), NumberStyles.Any, CultureInfo.InvariantCulture, out var ev) ? ev : null,
                        string.IsNullOrWhiteSpace(GetStr(d, "impact_unit")) ? null : GetStr(d, "impact_unit"),
                        string.IsNullOrWhiteSpace(GetStr(d, "notes")) ? null : GetStr(d, "notes"));
                })
                .OrderByDescending(x => x.DonationDate)
                .ToList();
        }
    }

    public DonationDto CreateDonation(
        int supporterId,
        string donationType,
        DateTime donationDate,
        decimal? amount,
        string? currencyCode,
        string? notes,
        string? campaignName)
    {
        lock (_lock)
        {
            if (_supporters.All(x => GetInt(x, "supporter_id") != supporterId))
                throw new InvalidOperationException("Unknown supporter.");
            var next = _donations.Max(x => GetInt(x, "donation_id")) + 1;
            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["donation_id"] = next.ToString(CultureInfo.InvariantCulture),
                ["supporter_id"] = supporterId.ToString(CultureInfo.InvariantCulture),
                ["donation_type"] = donationType,
                ["donation_date"] = donationDate.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture),
                ["is_recurring"] = "False",
                ["campaign_name"] = campaignName ?? string.Empty,
                ["channel_source"] = "Direct",
                ["currency_code"] = currencyCode ?? (donationType.Equals("Monetary", StringComparison.OrdinalIgnoreCase) ? "PHP" : string.Empty),
                ["amount"] = amount?.ToString(CultureInfo.InvariantCulture) ?? string.Empty,
                ["estimated_value"] = amount?.ToString(CultureInfo.InvariantCulture) ?? string.Empty,
                ["impact_unit"] = donationType.Equals("Time", StringComparison.OrdinalIgnoreCase) ? "hours" :
                    donationType.Equals("InKind", StringComparison.OrdinalIgnoreCase) ? "items" :
                    donationType.Equals("SocialMedia", StringComparison.OrdinalIgnoreCase) ? "campaigns" : "pesos",
                ["notes"] = notes ?? string.Empty,
                ["referral_post_id"] = string.Empty,
            };
            _donations.Add(row);
            return ListDonations(null).First(x => x.Id == next);
        }
    }

    public IReadOnlyList<DonationAllocationDto> ListAllocations(int? donationId, int? safehouseId)
    {
        lock (_lock)
        {
            IEnumerable<Dictionary<string, string>> q = _allocations;
            if (donationId is > 0)
                q = q.Where(a => GetInt(a, "donation_id") == donationId.Value);
            if (safehouseId is > 0)
                q = q.Where(a => GetInt(a, "safehouse_id") == safehouseId.Value);
            return q
                .Select(a => new DonationAllocationDto(
                    GetInt(a, "allocation_id"),
                    GetInt(a, "donation_id"),
                    GetInt(a, "safehouse_id"),
                    SafehouseName(GetInt(a, "safehouse_id")),
                    GetStr(a, "program_area"),
                    decimal.TryParse(GetStr(a, "amount_allocated"), NumberStyles.Any, CultureInfo.InvariantCulture, out var al) ? al : 0m,
                    ParseDateTime(GetStr(a, "allocation_date")) ?? DateTime.MinValue,
                    string.IsNullOrWhiteSpace(GetStr(a, "allocation_notes")) ? null : GetStr(a, "allocation_notes")))
                .OrderByDescending(x => x.AllocationDate)
                .ToList();
        }
    }

    public IReadOnlyList<SafehouseOptionDto> ListSafehousesOptions()
    {
        lock (_lock)
        {
            return _safehouses
                .Where(s => GetStr(s, "status").Equals("Active", StringComparison.OrdinalIgnoreCase))
                .Select(s => new SafehouseOptionDto(
                    GetInt(s, "safehouse_id"),
                    GetStr(s, "safehouse_code"),
                    GetStr(s, "name"),
                    GetStr(s, "region")))
                .OrderBy(x => x.Id)
                .ToList();
        }
    }

    public IReadOnlyList<ProcessRecordingDto> ListProcessRecordings(int? residentId)
    {
        lock (_lock)
        {
            IEnumerable<Dictionary<string, string>> q = _processRecordings;
            if (residentId is > 0)
                q = q.Where(p => GetInt(p, "resident_id") == residentId.Value);
            var list = q
                .Select(p => new ProcessRecordingDto(
                    GetInt(p, "recording_id"),
                    GetInt(p, "resident_id"),
                    ResidentCode(GetInt(p, "resident_id")),
                    ParseDateTime(GetStr(p, "session_date")) ?? DateTime.MinValue,
                    GetStr(p, "social_worker"),
                    GetStr(p, "session_type"),
                    int.TryParse(GetStr(p, "session_duration_minutes"), out var dm) ? dm : null,
                    NullIfEmpty(GetStr(p, "emotional_state_observed")),
                    NullIfEmpty(GetStr(p, "emotional_state_end")),
                    GetStr(p, "session_narrative"),
                    NullIfEmpty(GetStr(p, "interventions_applied")),
                    NullIfEmpty(GetStr(p, "follow_up_actions")),
                    GetBool(p, "progress_noted"),
                    GetBool(p, "concerns_flagged"),
                    GetBool(p, "referral_made")))
                .OrderBy(x => x.SessionDate)
                .ToList();
            if (residentId is null && list.Count > 120)
                return list.TakeLast(120).ToList();
            return list;
        }
    }

    private static string? NullIfEmpty(string s) => string.IsNullOrWhiteSpace(s) ? null : s;

    public ProcessRecordingDto CreateProcessRecording(
        int residentId,
        DateTime sessionDate,
        string socialWorker,
        string sessionType,
        int? durationMinutes,
        string? emotionalStart,
        string? emotionalEnd,
        string narrative,
        string? interventions,
        string? followUp,
        bool? progressNoted,
        bool? concernsFlagged,
        bool? referralMade)
    {
        lock (_lock)
        {
            if (_residents.All(x => GetInt(x, "resident_id") != residentId))
                throw new InvalidOperationException("Unknown resident.");
            var next = _processRecordings.Count == 0 ? 1 : _processRecordings.Max(x => GetInt(x, "recording_id")) + 1;
            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["recording_id"] = next.ToString(CultureInfo.InvariantCulture),
                ["resident_id"] = residentId.ToString(CultureInfo.InvariantCulture),
                ["session_date"] = sessionDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                ["social_worker"] = socialWorker,
                ["session_type"] = sessionType,
                ["session_duration_minutes"] = durationMinutes?.ToString(CultureInfo.InvariantCulture) ?? string.Empty,
                ["emotional_state_observed"] = emotionalStart ?? string.Empty,
                ["emotional_state_end"] = emotionalEnd ?? string.Empty,
                ["session_narrative"] = narrative,
                ["interventions_applied"] = interventions ?? string.Empty,
                ["follow_up_actions"] = followUp ?? string.Empty,
                ["progress_noted"] = (progressNoted ?? true) ? "True" : "False",
                ["concerns_flagged"] = (concernsFlagged ?? false) ? "True" : "False",
                ["referral_made"] = (referralMade ?? false) ? "True" : "False",
                ["notes_restricted"] = string.Empty,
            };
            _processRecordings.Add(row);
            return ListProcessRecordings(residentId).Last();
        }
    }

    public ProcessRecordingDto? PatchProcessRecording(int id, PatchProcessRecordingDto p)
    {
        lock (_lock)
        {
            var row = _processRecordings.FirstOrDefault(x => GetInt(x, "recording_id") == id);
            if (row is null) return null;
            if (p.SessionDate.HasValue) row["session_date"] = p.SessionDate.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            if (p.SocialWorker != null) row["social_worker"] = p.SocialWorker;
            if (p.SessionType != null) row["session_type"] = p.SessionType;
            if (p.SessionDurationMinutes.HasValue) row["session_duration_minutes"] = p.SessionDurationMinutes.Value.ToString(CultureInfo.InvariantCulture);
            if (p.EmotionalStateObserved != null) row["emotional_state_observed"] = p.EmotionalStateObserved;
            if (p.EmotionalStateEnd != null) row["emotional_state_end"] = p.EmotionalStateEnd;
            if (p.SessionNarrative != null) row["session_narrative"] = p.SessionNarrative;
            if (p.InterventionsApplied != null) row["interventions_applied"] = p.InterventionsApplied;
            if (p.FollowUpActions != null) row["follow_up_actions"] = p.FollowUpActions;
            if (p.ProgressNoted.HasValue) row["progress_noted"] = p.ProgressNoted.Value ? "True" : "False";
            if (p.ConcernsFlagged.HasValue) row["concerns_flagged"] = p.ConcernsFlagged.Value ? "True" : "False";
            if (p.ReferralMade.HasValue) row["referral_made"] = p.ReferralMade.Value ? "True" : "False";
            return ListProcessRecordings(GetInt(row, "resident_id")).First(x => x.Id == id);
        }
    }

    public IReadOnlyList<HomeVisitationDto> ListHomeVisitations(int? residentId)
    {
        lock (_lock)
        {
            IEnumerable<Dictionary<string, string>> q = _homeVisitations;
            if (residentId is > 0)
                q = q.Where(v => GetInt(v, "resident_id") == residentId.Value);
            return q
                .Select(v => new HomeVisitationDto(
                    GetInt(v, "visitation_id"),
                    GetInt(v, "resident_id"),
                    ResidentCode(GetInt(v, "resident_id")),
                    ParseDateTime(GetStr(v, "visit_date")) ?? DateTime.MinValue,
                    GetStr(v, "social_worker"),
                    GetStr(v, "visit_type"),
                    NullIfEmpty(GetStr(v, "location_visited")),
                    NullIfEmpty(GetStr(v, "family_members_present")),
                    NullIfEmpty(GetStr(v, "purpose")),
                    NullIfEmpty(GetStr(v, "observations")),
                    NullIfEmpty(GetStr(v, "family_cooperation_level")),
                    GetBool(v, "safety_concerns_noted"),
                    GetBool(v, "follow_up_needed"),
                    NullIfEmpty(GetStr(v, "follow_up_notes")),
                    NullIfEmpty(GetStr(v, "visit_outcome"))))
                .OrderByDescending(x => x.VisitDate)
                .ToList();
        }
    }

    public HomeVisitationDto CreateHomeVisitation(
        int residentId,
        DateTime visitDate,
        string socialWorker,
        string visitType,
        string? locationVisited,
        string? observations,
        string? familyCooperation,
        bool safetyConcerns,
        bool followUpNeeded,
        string? followUpNotes,
        string? purpose,
        string? familyMembersPresent,
        string? visitOutcome)
    {
        lock (_lock)
        {
            if (_residents.All(x => GetInt(x, "resident_id") != residentId))
                throw new InvalidOperationException("Unknown resident.");
            var next = _homeVisitations.Count == 0 ? 1 : _homeVisitations.Max(x => GetInt(x, "visitation_id")) + 1;
            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["visitation_id"] = next.ToString(CultureInfo.InvariantCulture),
                ["resident_id"] = residentId.ToString(CultureInfo.InvariantCulture),
                ["visit_date"] = visitDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                ["social_worker"] = socialWorker,
                ["visit_type"] = visitType,
                ["location_visited"] = locationVisited ?? string.Empty,
                ["family_members_present"] = familyMembersPresent ?? string.Empty,
                ["purpose"] = string.IsNullOrWhiteSpace(purpose) ? $"Visitation for {visitType.ToLowerInvariant()}" : purpose,
                ["observations"] = observations ?? string.Empty,
                ["family_cooperation_level"] = familyCooperation ?? string.Empty,
                ["safety_concerns_noted"] = safetyConcerns ? "True" : "False",
                ["follow_up_needed"] = followUpNeeded ? "True" : "False",
                ["follow_up_notes"] = followUpNotes ?? string.Empty,
                ["visit_outcome"] = string.IsNullOrWhiteSpace(visitOutcome) ? "Favorable" : visitOutcome,
            };
            _homeVisitations.Add(row);
            return ListHomeVisitations(residentId).First(x => x.Id == next);
        }
    }

    public HomeVisitationDto? PatchHomeVisitation(int id, PatchHomeVisitationDto p)
    {
        lock (_lock)
        {
            var row = _homeVisitations.FirstOrDefault(x => GetInt(x, "visitation_id") == id);
            if (row is null) return null;
            if (p.VisitDate.HasValue) row["visit_date"] = p.VisitDate.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            if (p.SocialWorker != null) row["social_worker"] = p.SocialWorker;
            if (p.VisitType != null) row["visit_type"] = p.VisitType;
            if (p.LocationVisited != null) row["location_visited"] = p.LocationVisited;
            if (p.FamilyMembersPresent != null) row["family_members_present"] = p.FamilyMembersPresent;
            if (p.Purpose != null) row["purpose"] = p.Purpose;
            if (p.Observations != null) row["observations"] = p.Observations;
            if (p.FamilyCooperationLevel != null) row["family_cooperation_level"] = p.FamilyCooperationLevel;
            if (p.SafetyConcernsNoted.HasValue) row["safety_concerns_noted"] = p.SafetyConcernsNoted.Value ? "True" : "False";
            if (p.FollowUpNeeded.HasValue) row["follow_up_needed"] = p.FollowUpNeeded.Value ? "True" : "False";
            if (p.FollowUpNotes != null) row["follow_up_notes"] = p.FollowUpNotes;
            if (p.VisitOutcome != null) row["visit_outcome"] = p.VisitOutcome;
            return ListHomeVisitations(GetInt(row, "resident_id")).First(x => x.Id == id);
        }
    }

    public InterventionPlanDto CreateInterventionPlan(int residentId, string planCategory, string planDescription, string? status,
        DateOnly? targetDate, DateOnly? caseConferenceDate, double? targetValue, string? servicesProvided)
    {
        lock (_lock)
        {
            if (_residents.All(x => GetInt(x, "resident_id") != residentId))
                throw new InvalidOperationException("Unknown resident.");
            var next = _interventionPlans.Count == 0 ? 1 : _interventionPlans.Max(x => GetInt(x, "plan_id")) + 1;
            var now = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);
            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["plan_id"] = next.ToString(CultureInfo.InvariantCulture),
                ["resident_id"] = residentId.ToString(CultureInfo.InvariantCulture),
                ["plan_category"] = planCategory,
                ["plan_description"] = planDescription,
                ["services_provided"] = servicesProvided ?? string.Empty,
                ["target_value"] = targetValue?.ToString(CultureInfo.InvariantCulture) ?? string.Empty,
                ["target_date"] = targetDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty,
                ["status"] = string.IsNullOrWhiteSpace(status) ? "In Progress" : status,
                ["case_conference_date"] = caseConferenceDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty,
                ["created_at"] = now,
                ["updated_at"] = now,
            };
            _interventionPlans.Add(row);
            return ListInterventionPlans(residentId).First(x => x.Id == next);
        }
    }

    public InterventionPlanDto? PatchInterventionPlan(int id, PatchInterventionPlanDto p)
    {
        lock (_lock)
        {
            var row = _interventionPlans.FirstOrDefault(x => GetInt(x, "plan_id") == id);
            if (row is null) return null;
            if (p.PlanCategory != null) row["plan_category"] = p.PlanCategory;
            if (p.PlanDescription != null) row["plan_description"] = p.PlanDescription;
            if (p.ServicesProvided != null) row["services_provided"] = p.ServicesProvided;
            if (p.TargetValue.HasValue) row["target_value"] = p.TargetValue.Value.ToString(CultureInfo.InvariantCulture);
            if (p.TargetDate != null)
            {
                if (string.IsNullOrWhiteSpace(p.TargetDate)) row["target_date"] = string.Empty;
                else row["target_date"] = p.TargetDate;
            }
            if (p.Status != null) row["status"] = p.Status;
            if (p.CaseConferenceDate != null)
            {
                if (string.IsNullOrWhiteSpace(p.CaseConferenceDate)) row["case_conference_date"] = string.Empty;
                else row["case_conference_date"] = p.CaseConferenceDate;
            }
            row["updated_at"] = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);
            return ListInterventionPlans(GetInt(row, "resident_id")).First(x => x.Id == id);
        }
    }

    public IReadOnlyList<InterventionPlanDto> ListInterventionPlans(int? residentId)
    {
        lock (_lock)
        {
            IEnumerable<Dictionary<string, string>> q = _interventionPlans;
            if (residentId is > 0)
                q = q.Where(p => GetInt(p, "resident_id") == residentId.Value);
            return q
                .Select(p => new InterventionPlanDto(
                    GetInt(p, "plan_id"),
                    GetInt(p, "resident_id"),
                    ResidentCode(GetInt(p, "resident_id")),
                    GetStr(p, "plan_category"),
                    GetStr(p, "plan_description"),
                    NullIfEmpty(GetStr(p, "services_provided")),
                    double.TryParse(GetStr(p, "target_value"), NumberStyles.Any, CultureInfo.InvariantCulture, out var tv) ? tv : null,
                    ParseDateTime(GetStr(p, "target_date"))?.Date,
                    GetStr(p, "status"),
                    ParseDateTime(GetStr(p, "case_conference_date"))?.Date,
                    ParseDateTime(GetStr(p, "created_at")) ?? DateTime.MinValue,
                    ParseDateTime(GetStr(p, "updated_at")) ?? DateTime.MinValue))
                .OrderByDescending(x => x.CaseConferenceDate ?? DateTime.MinValue)
                .ToList();
        }
    }

    public ReportsSummaryDto GetReportsSummary()
    {
        lock (_lock)
        {
            var total = _residents.Count;
            var active = _residents.Count(r => GetStr(r, "case_status").Equals("Active", StringComparison.OrdinalIgnoreCase));
            var closed = _residents.Count(r => GetStr(r, "case_status").Equals("Closed", StringComparison.OrdinalIgnoreCase));
            var monetary = _donations
                .Where(d => GetStr(d, "donation_type").Equals("Monetary", StringComparison.OrdinalIgnoreCase))
                .Sum(d => decimal.TryParse(GetStr(d, "amount"), NumberStyles.Any, CultureInfo.InvariantCulture, out var a) ? a : 0m);

            var trends = _donations
                .Where(d => GetStr(d, "donation_type").Equals("Monetary", StringComparison.OrdinalIgnoreCase))
                .Select(d => new
                {
                    Dt = ParseDateTime(GetStr(d, "donation_date")),
                    Amt = decimal.TryParse(GetStr(d, "amount"), NumberStyles.Any, CultureInfo.InvariantCulture, out var a) ? a : 0m,
                })
                .Where(x => x.Dt.HasValue)
                .GroupBy(x => new { x.Dt!.Value.Year, x.Dt!.Value.Month })
                .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
                .Select(g => new MonthlyDonationTrendDto(
                    $"{g.Key.Year}-{g.Key.Month:D2}",
                    g.Sum(x => x.Amt),
                    g.Count()))
                .ToList();

            var latestMonth = _safehouseMonthly
                .Select(m => new
                {
                    Sh = GetInt(m, "safehouse_id"),
                    Start = ParseDateTime(GetStr(m, "month_start")),
                    Edu = double.TryParse(GetStr(m, "avg_education_progress"), NumberStyles.Any, CultureInfo.InvariantCulture, out var e) ? e : (double?)null,
                    Hl = double.TryParse(GetStr(m, "avg_health_score"), NumberStyles.Any, CultureInfo.InvariantCulture, out var h) ? h : (double?)null,
                })
                .Where(x => x.Start.HasValue)
                .GroupBy(x => x.Sh)
                .Select(g => g.OrderByDescending(x => x.Start).First())
                .ToList();

            var residentSafehouse = _residents
                .Where(r => GetStr(r, "case_status").Equals("Active", StringComparison.OrdinalIgnoreCase))
                .ToDictionary(r => GetInt(r, "resident_id"), r => GetInt(r, "safehouse_id"));

            var eduLists = new Dictionary<int, List<double>>();
            foreach (var e in _educationRecords)
            {
                var rid = GetInt(e, "resident_id");
                if (!residentSafehouse.TryGetValue(rid, out var sh)) continue;
                if (!double.TryParse(GetStr(e, "progress_percent"), NumberStyles.Any, CultureInfo.InvariantCulture, out var v)) continue;
                if (!eduLists.TryGetValue(sh, out var list))
                {
                    list = [];
                    eduLists[sh] = list;
                }
                list.Add(v);
            }

            var hlLists = new Dictionary<int, List<double>>();
            foreach (var h in _healthRecords)
            {
                var rid = GetInt(h, "resident_id");
                if (!residentSafehouse.TryGetValue(rid, out var sh)) continue;
                if (!double.TryParse(GetStr(h, "general_health_score"), NumberStyles.Any, CultureInfo.InvariantCulture, out var v)) continue;
                if (!hlLists.TryGetValue(sh, out var list))
                {
                    list = [];
                    hlLists[sh] = list;
                }
                list.Add(v);
            }

            var eduAvgBySh = eduLists.ToDictionary(kv => kv.Key, kv => kv.Value.Average());
            var hlAvgBySh = hlLists.ToDictionary(kv => kv.Key, kv => kv.Value.Average());

            var perf = _safehouses
                .Where(s => GetStr(s, "status").Equals("Active", StringComparison.OrdinalIgnoreCase))
                .Select(s =>
                {
                    var id = GetInt(s, "safehouse_id");
                    var occ = GetInt(s, "current_occupancy");
                    var cap = Math.Max(GetInt(s, "capacity_girls"), 1);
                    var lm = latestMonth.FirstOrDefault(x => x.Sh == id);
                    double? edu = eduAvgBySh.TryGetValue(id, out var eAvg) ? Math.Round(eAvg, 1) : lm?.Edu;
                    double? hl = hlAvgBySh.TryGetValue(id, out var hAvg) ? Math.Round(hAvg, 2) : lm?.Hl;
                    return new SafehousePerformanceDto(
                        id,
                        GetStr(s, "name"),
                        _residents.Count(r =>
                            GetInt(r, "safehouse_id") == id &&
                            GetStr(r, "case_status").Equals("Active", StringComparison.OrdinalIgnoreCase)),
                        cap,
                        Math.Round(100.0 * occ / cap, 1),
                        edu,
                        hl);
                })
                .OrderBy(x => x.SafehouseId)
                .ToList();

            var eduVals = _educationRecords
                .Select(e => double.TryParse(GetStr(e, "progress_percent"), NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : (double?)null)
                .Where(v => v.HasValue)
                .Select(v => v!.Value)
                .ToList();
            var eduAvg = eduVals.Count == 0 ? 0 : eduVals.Average();
            var hlVals = _healthRecords
                .Select(e => double.TryParse(GetStr(e, "general_health_score"), NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : (double?)null)
                .Where(v => v.HasValue)
                .Select(v => v!.Value)
                .ToList();
            var hlAvg = hlVals.Count == 0 ? 0 : hlVals.Average();

            var pillars = CountPillarKeywords();

            var completedReint = _residents.Count(r =>
                GetStr(r, "reintegration_status").Equals("Completed", StringComparison.OrdinalIgnoreCase));
            var highlights = new List<string>
            {
                $"{active} active residents across {perf.Count} operational safehouses.",
                $"Average education progress from assessments on file: {eduAvg:F1}%.",
                $"Average wellbeing score from records on file: {hlAvg:F2} (typical scale 1–5).",
                $"{completedReint} resident{(completedReint == 1 ? "" : "s")} with reintegration marked completed.",
            };

            return new ReportsSummaryDto(
                total,
                active,
                closed,
                monetary,
                _processRecordings.Count,
                trends,
                perf,
                new ResidentOutcomeMetricsDto(Math.Round(eduAvg, 2), Math.Round(hlAvg, 2), _educationRecords.Count, _healthRecords.Count),
                new AarStyleReportDto(
                    total,
                    pillars,
                    highlights));
        }
    }

    private ServicePillarCountsDto CountPillarKeywords()
    {
        var caring = 0;
        var healing = 0;
        var teaching = 0;
        foreach (var p in _processRecordings)
        {
            var iv = GetStr(p, "interventions_applied");
            if (iv.Contains("Caring", StringComparison.OrdinalIgnoreCase)) caring++;
            if (iv.Contains("Healing", StringComparison.OrdinalIgnoreCase)) healing++;
            if (iv.Contains("Teaching", StringComparison.OrdinalIgnoreCase)) teaching++;
        }
        return new ServicePillarCountsDto(caring, healing, teaching);
    }

    public PublicImpactSummaryDto GetPublicImpactSummary()
    {
        lock (_lock)
        {
            var active = _residents.Count(r => GetStr(r, "case_status").Equals("Active", StringComparison.OrdinalIgnoreCase));
            var shCount = _safehouses.Count(s => GetStr(s, "status").Equals("Active", StringComparison.OrdinalIgnoreCase));
            var eduAvg = _educationRecords.Count == 0 ? 0 :
                _educationRecords.Average(e => double.TryParse(GetStr(e, "progress_percent"), NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : 0);
            var hlAvg = _healthRecords.Count == 0 ? 0 :
                _healthRecords.Average(e => double.TryParse(GetStr(e, "general_health_score"), NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : 0);
            var lastMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1).AddMonths(-1);
            var donationsLast = _donations
                .Where(d => GetStr(d, "donation_type").Equals("Monetary", StringComparison.OrdinalIgnoreCase))
                .Where(d =>
                {
                    var dt = ParseDateTime(GetStr(d, "donation_date"));
                    return dt.HasValue && dt.Value.Year == lastMonth.Year && dt.Value.Month == lastMonth.Month;
                })
                .Sum(d => decimal.TryParse(GetStr(d, "amount"), NumberStyles.Any, CultureInfo.InvariantCulture, out var a) ? a : 0m);
            var supporters = _supporters.Count;
            var completed = _residents.Count(r => GetStr(r, "reintegration_status").Equals("Completed", StringComparison.OrdinalIgnoreCase));
            var denom = Math.Max(_residents.Count(r => !string.IsNullOrWhiteSpace(GetStr(r, "reintegration_status"))), 1);
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
    }

    public IReadOnlyList<PublicImpactSnapshotDto> GetPublishedSnapshots()
    {
        lock (_lock)
        {
            return _snapshots
                .Where(s => GetStr(s, "is_published").Equals("True", StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(s => GetStr(s, "snapshot_date"))
                .Take(24)
                .Select(s => new PublicImpactSnapshotDto(
                    GetInt(s, "snapshot_id"),
                    DateOnly.TryParse(GetStr(s, "snapshot_date"), CultureInfo.InvariantCulture, out var sd) ? sd : default,
                    GetStr(s, "headline"),
                    GetStr(s, "summary_text"),
                    ParsePythonishMetrics(GetStr(s, "metric_payload_json")),
                    true))
                .ToList();
        }
    }

    public IReadOnlyList<EnrollmentGrowthPointDto> GetEnrollmentGrowthSeries()
    {
        lock (_lock)
        {
            var enrolledDates = new List<DateOnly>();
            foreach (var r in _residents)
            {
                var s = GetStr(r, "date_enrolled");
                if (DateOnly.TryParse(s, CultureInfo.InvariantCulture, out var d))
                    enrolledDates.Add(d);
            }

            var seriesStart = new DateOnly(2023, 1, 1);
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var endMonth = new DateOnly(today.Year, today.Month, 1);
            var ci = CultureInfo.GetCultureInfo("en-US");
            var list = new List<EnrollmentGrowthPointDto>();
            for (var m = seriesStart; m <= endMonth; m = m.AddMonths(1))
            {
                var lastDay = new DateOnly(m.Year, m.Month, DateTime.DaysInMonth(m.Year, m.Month));
                var count = enrolledDates.Count(d => d <= lastDay);
                var key = $"{m.Year:D4}-{m.Month:D2}";
                var period = new DateTime(m.Year, m.Month, 1, 0, 0, 0, DateTimeKind.Utc).ToString("MMM yyyy", ci);
                list.Add(new EnrollmentGrowthPointDto(key, period, count));
            }

            return list;
        }
    }

    // ── ML feature extraction ─────────────────────────────────────────────────

    /// <summary>
    /// Aggregates CSV data into the feature vector expected by the
    /// Reintegration Readiness model. Returns null if the resident is unknown.
    /// </summary>
    public ReintegrationFeaturesDto? GetReintegrationFeatures(int residentId)
    {
        lock (_lock)
        {
            var r = _residents.FirstOrDefault(x => GetInt(x, "resident_id") == residentId);
            if (r is null) return null;

            var now = DateTime.UtcNow;

            int ageAtEntry = GetInt(r, "age_at_entry");
            var safeId     = GetStr(r, "safehouse_id");
            var referral   = GetStr(r, "referral_source");
            int daysInProg = 0;
            if (DateTime.TryParse(GetStr(r, "date_of_admission"), out var admDate))
                daysInProg = Math.Max(0, (int)(now - admDate).TotalDays);

            // Process recordings
            var recs = _processRecordings.Where(p => GetInt(p, "resident_id") == residentId).ToList();
            int totalSessions   = recs.Count;
            double pctProgress  = totalSessions == 0 ? 0.0 : recs.Count(p => GetBool(p, "progress_noted"))  / (double)totalSessions;
            double pctConcerns  = totalSessions == 0 ? 0.0 : recs.Count(p => GetBool(p, "concerns_flagged")) / (double)totalSessions;
            int totalIncidents  = recs.Count(p => GetBool(p, "concerns_flagged"));

            // Education records
            var edRecs = _educationRecords.Where(e => GetInt(e, "resident_id") == residentId).ToList();
            double latestAttendance = 0.0;
            double avgProgress      = 0.0;
            if (edRecs.Count > 0)
            {
                var latest = edRecs
                    .OrderByDescending(e => int.TryParse(GetStr(e, "record_seq"), out var seq) ? seq : 0)
                    .First();
                if (double.TryParse(GetStr(latest, "attendance_rate"), NumberStyles.Any, CultureInfo.InvariantCulture, out var ar))
                    latestAttendance = ar;
                var progVals = edRecs
                    .Select(e => double.TryParse(GetStr(e, "progress_percent"), NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : (double?)null)
                    .Where(v => v.HasValue).Select(v => v!.Value).ToList();
                if (progVals.Count > 0) avgProgress = progVals.Average();
            }

            // Health records
            var hlRecs = _healthRecords.Where(h => GetInt(h, "resident_id") == residentId).ToList();
            double avgHealth = 5.0;
            double pctPsych  = 0.0;
            if (hlRecs.Count > 0)
            {
                var hlVals = hlRecs
                    .Select(h => double.TryParse(GetStr(h, "general_health_score"), NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : (double?)null)
                    .Where(v => v.HasValue).Select(v => v!.Value).ToList();
                if (hlVals.Count > 0) avgHealth = hlVals.Average();
                pctPsych = hlRecs.Count(h => GetBool(h, "psychological_checkup_done")) / (double)hlRecs.Count;
            }

            // Intervention plans
            var plans    = _interventionPlans.Where(p => GetInt(p, "resident_id") == residentId).ToList();
            int totalPl  = plans.Count;
            double pctAch = totalPl == 0 ? 0.0
                : plans.Count(p => GetStr(p, "status").Equals("Achieved", StringComparison.OrdinalIgnoreCase)) / (double)totalPl;

            return new ReintegrationFeaturesDto(
                ResidentId:           residentId,
                SafehouseId:          string.IsNullOrWhiteSpace(safeId) ? "Unknown" : safeId,
                AgeAtEntry:           ageAtEntry == 0 ? 15 : Math.Clamp(ageAtEntry, 10, 25),
                DaysInProgram:        daysInProg,
                ReferralSource:       string.IsNullOrWhiteSpace(referral) ? "Unknown" : referral,
                TotalSessions:        totalSessions,
                PctProgressNoted:     pctProgress,
                PctConcernsFlagged:   pctConcerns,
                LatestAttendanceRate: latestAttendance,
                AvgProgressPercent:   avgProgress,
                AvgGeneralHealthScore: Math.Clamp(avgHealth, 1.0, 10.0),
                PctPsychCheckupDone:  pctPsych,
                NumHealthRecords:     hlRecs.Count,
                TotalIncidents:       totalIncidents,
                NumSevereIncidents:   0,
                TotalPlans:           totalPl,
                PctPlansAchieved:     pctAch
            );
        }
    }

    /// <summary>
    /// Returns one feature vector per monetary-donor supporter for the
    /// Donor Churn model.
    /// </summary>
    public IReadOnlyList<DonorChurnFeaturesDto> GetDonorChurnFeatures()
    {
        lock (_lock)
        {
            var now = DateTime.UtcNow;
            return _supporters
                .Where(s =>
                {
                    var t = GetStr(s, "supporter_type");
                    return t.Equals("MonetaryDonor", StringComparison.OrdinalIgnoreCase)
                        || t.Equals("PartnerOrganization", StringComparison.OrdinalIgnoreCase);
                })
                .Select(s =>
                {
                    var sid   = GetInt(s, "supporter_id");
                    var sType = GetStr(s, "supporter_type");
                    var chan  = GetStr(s, "acquisition_channel");

                    var gifts = _donations
                        .Where(d => GetInt(d, "supporter_id") == sid
                                 && GetStr(d, "donation_type").Equals("Monetary", StringComparison.OrdinalIgnoreCase)
                                 && double.TryParse(GetStr(d, "amount"), NumberStyles.Any, CultureInfo.InvariantCulture, out _))
                        .ToList();

                    double totalDon  = gifts.Count;
                    double totalAmt  = gifts.Sum(d => double.TryParse(GetStr(d, "amount"), NumberStyles.Any, CultureInfo.InvariantCulture, out var a) ? a : 0);
                    double avgAmt    = totalDon > 0 ? totalAmt / totalDon : 0;
                    double monthsAgo = 999;
                    if (gifts.Count > 0)
                    {
                        var lastDate = gifts
                            .Select(d => ParseDateTime(GetStr(d, "donation_date")))
                            .Where(d => d.HasValue)
                            .Select(d => d!.Value)
                            .DefaultIfEmpty(now)
                            .Max();
                        monthsAgo = (now - lastDate).TotalDays / 30.4;
                    }
                    var datesOrdered = gifts
                        .Select(d => ParseDateTime(GetStr(d, "donation_date")))
                        .Where(d => d.HasValue).Select(d => d!.Value)
                        .OrderBy(d => d).ToList();
                    double freq = datesOrdered.Count > 1
                        ? totalDon / Math.Max(1, (datesOrdered.Last() - datesOrdered.First()).TotalDays / 30.4)
                        : 0;
                    double isRec  = gifts.Any(d => GetBool(d, "is_recurring")) ? 1.0 : 0.0;
                    double numCam = gifts.Select(d => GetStr(d, "campaign_name")).Distinct().Count(c => !string.IsNullOrWhiteSpace(c));
                    double chanDiv = string.IsNullOrWhiteSpace(chan) ? 1 : 1; // single channel per supporter in this schema

                    return new DonorChurnFeaturesDto(
                        SupporterId:        sid,
                        SupporterType:      sType,
                        TotalDonations:     totalDon,
                        TotalAmountPhp:     totalAmt,
                        MonthsSinceLastGift: monthsAgo,
                        AvgGiftAmount:      avgAmt,
                        DonationFrequency:  freq,
                        IsRecurring:        isRec,
                        NumCampaigns:       numCam,
                        ChannelDiversity:   chanDiv
                    );
                })
                .ToList();
        }
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
