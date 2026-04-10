using System.Data;
using System.Text.Json.Serialization;
using Dapper;
using EbanHaven.Api.DataAccess;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EbanHaven.Api.Controllers;

// ── DTOs ──────────────────────────────────────────────────────────────────────

internal sealed record ReintegrationFeaturesPayload(
    [property: JsonPropertyName("resident_id")]              int    ResidentId,
    [property: JsonPropertyName("safehouse_id")]             string SafehouseId,
    [property: JsonPropertyName("age_at_entry")]             int    AgeAtEntry,
    [property: JsonPropertyName("days_in_program")]          int    DaysInProgram,
    [property: JsonPropertyName("referral_source")]          string ReferralSource,
    [property: JsonPropertyName("current_risk_level")]       string CurrentRiskLevel,
    [property: JsonPropertyName("reintegration_type")]       string ReintegrationType,
    [property: JsonPropertyName("case_status")]              string CaseStatus,
    [property: JsonPropertyName("total_sessions")]           double TotalSessions,
    [property: JsonPropertyName("pct_progress_noted")]       double PctProgressNoted,
    [property: JsonPropertyName("pct_concerns_flagged")]     double PctConcernsFlagged,
    [property: JsonPropertyName("latest_attendance_rate")]   double LatestAttendanceRate,
    [property: JsonPropertyName("avg_progress_percent")]     double AvgProgressPercent,
    [property: JsonPropertyName("avg_general_health_score")] double AvgGeneralHealthScore,
    [property: JsonPropertyName("pct_psych_checkup_done")]   double PctPsychCheckupDone,
    [property: JsonPropertyName("num_health_records")]       double NumHealthRecords,
    [property: JsonPropertyName("total_incidents")]          double TotalIncidents,
    [property: JsonPropertyName("num_severe_incidents")]     double NumSevereIncidents,
    [property: JsonPropertyName("total_plans")]              double TotalPlans,
    [property: JsonPropertyName("pct_plans_achieved")]       double PctPlansAchieved,
    [property: JsonPropertyName("active_plan_count")]        double ActivePlanCount
);

internal sealed record ImprovementArea(
    [property: JsonPropertyName("feature")]         string Feature,
    [property: JsonPropertyName("label")]           string Label,
    [property: JsonPropertyName("resident_value")]  double ResidentValue,
    [property: JsonPropertyName("benchmark_value")] double BenchmarkValue,
    [property: JsonPropertyName("gap_score")]       double GapScore,
    [property: JsonPropertyName("suggestion")]      string Suggestion
);

internal sealed record ReintegrationPredictionResponse(
    [property: JsonPropertyName("resident_id")]               int?                ResidentId,
    [property: JsonPropertyName("reintegration_probability")] double              ReintegrationProbability,
    [property: JsonPropertyName("prediction")]                string              Prediction,
    [property: JsonPropertyName("risk_tier")]                 string              RiskTier,
    [property: JsonPropertyName("threshold_used")]            double              ThresholdUsed,
    [property: JsonPropertyName("top_improvements")]          List<ImprovementArea> TopImprovements
);

internal sealed record ReintegrationCohortResidentResponse(
    [property: JsonPropertyName("id")]                         int Id,
    [property: JsonPropertyName("caseControlNo")]              string CaseControlNo,
    [property: JsonPropertyName("internalCode")]               string InternalCode,
    [property: JsonPropertyName("safehouseId")]                int SafehouseId,
    [property: JsonPropertyName("safehouseName")]              string? SafehouseName,
    [property: JsonPropertyName("caseStatus")]                 string CaseStatus,
    [property: JsonPropertyName("caseCategory")]               string CaseCategory,
    [property: JsonPropertyName("sex")]                        string Sex,
    [property: JsonPropertyName("assignedSocialWorker")]       string? AssignedSocialWorker,
    [property: JsonPropertyName("dateOfAdmission")]            string? DateOfAdmission,
    [property: JsonPropertyName("reintegrationStatus")]        string? ReintegrationStatus,
    [property: JsonPropertyName("reintegrationType")]          string? ReintegrationType,
    [property: JsonPropertyName("presentAge")]                 string? PresentAge,
    [property: JsonPropertyName("lengthOfStay")]               string? LengthOfStay,
    [property: JsonPropertyName("currentRiskLevel")]           string? CurrentRiskLevel,
    [property: JsonPropertyName("readiness")]                  ReintegrationPredictionResponse Readiness
);

internal sealed record ReintegrationCohortResponse(
    [property: JsonPropertyName("residents")]                  List<ReintegrationCohortResidentResponse> Residents,
    [property: JsonPropertyName("failed_count")]               int FailedCount
);

internal sealed record ResidentCohortRow(
    int Id,
    string CaseControlNo,
    string InternalCode,
    int SafehouseId,
    string? SafehouseName,
    string CaseStatus,
    string CaseCategory,
    string Sex,
    string? AssignedSocialWorker,
    DateOnly? DateOfAdmission,
    string? ReintegrationStatus,
    string? ReintegrationType,
    string? PresentAge,
    string? LengthOfStay,
    string? CurrentRiskLevel
);

// ── Controller ────────────────────────────────────────────────────────────────

[ApiController]
[Route("api/residents")]
[Authorize]
public sealed class ReintegrationReadinessController(HavenDbContext db, IHttpClientFactory httpFactory) : ControllerBase
{
    // Extracts the enriched feature vector expected by the Reintegration Readiness model.
    //
    // Column inventory (only EF-mapped columns are queried — optional migration columns
    // attendance_rate / psychological_checkup_done / age_upon_admission / referral_source
    // may not exist on all environments, so we use safe defaults for those features):
    //  residents          : resident_id, safehouse_id, date_of_admission, present_age,
    //                       current_risk_level, reintegration_type, case_status
    //  process_recordings : progress_noted (bool), concerns_flagged (bool)
    //  education_records  : progress_percent
    //  health_wellbeing   : general_health_score
    //  incident_reports   : severity
    //  intervention_plans : status
    private const string FeatureSql = """
        WITH
          session_agg AS (
            SELECT
              COUNT(*)::float                                                                    AS total_sessions,
              COALESCE(AVG(CASE WHEN progress_noted  THEN 1.0 ELSE 0.0 END), 0.0)              AS pct_progress_noted,
              COALESCE(AVG(CASE WHEN concerns_flagged THEN 1.0 ELSE 0.0 END), 0.0)             AS pct_concerns_flagged
            FROM process_recordings
            WHERE resident_id = @ResidentId
          ),
          edu_agg AS (
            SELECT COALESCE(AVG(progress_percent), 0.0) AS avg_progress_percent
            FROM education_records
            WHERE resident_id = @ResidentId
          ),
          health_agg AS (
            SELECT
              COALESCE(AVG(general_health_score), 5.0)                                         AS avg_health_score,
              COUNT(*)::float                                                                   AS num_health_records
            FROM health_wellbeing_records
            WHERE resident_id = @ResidentId
          ),
          incident_agg AS (
            SELECT
              COUNT(*)::float                                                                    AS total_incidents,
              COUNT(*) FILTER (WHERE severity IN ('High', 'Severe', 'Critical'))::float         AS num_severe_incidents
            FROM incident_reports
            WHERE resident_id = @ResidentId
          ),
          plan_agg AS (
            SELECT
              COUNT(*)::float                                                                    AS total_plans,
              COUNT(*) FILTER (
                WHERE status IS NOT NULL
                  AND status NOT ILIKE 'Achieved'
                  AND status NOT ILIKE 'Completed'
                  AND status NOT ILIKE 'Cancelled'
                  AND status NOT ILIKE 'Closed'
              )::float                                                                          AS active_plan_count,
              CASE
                WHEN COUNT(*) = 0 THEN 0.0
                ELSE COUNT(*) FILTER (WHERE status ILIKE 'Achieved' OR status ILIKE 'Completed')::float / COUNT(*)::float
              END                                                                               AS pct_plans_achieved
            FROM intervention_plans
            WHERE resident_id = @ResidentId
          )
        SELECT
          r.resident_id,
          COALESCE(s.safehouse_code, 'Unknown')                                                  AS safehouse_code,
          CASE
            WHEN r.present_age ~ '^\d+$'
              THEN LEAST(25, GREATEST(10, r.present_age::int))
            ELSE 15
          END                                                                                   AS age_at_entry,
          GREATEST(0,
            CASE
              WHEN r.date_of_admission IS NOT NULL
                THEN EXTRACT(EPOCH FROM (NOW() - r.date_of_admission))::int / 86400
              ELSE 0
            END
          )                                                                                     AS days_in_program,
          COALESCE(r.current_risk_level, 'Unknown')                                             AS current_risk_level,
          COALESCE(r.reintegration_type, 'Unknown')                                             AS reintegration_type,
          COALESCE(r.case_status, 'Unknown')                                                    AS case_status,
          sa.total_sessions,
          sa.pct_progress_noted,
          sa.pct_concerns_flagged,
          ea.avg_progress_percent,
          LEAST(10.0, GREATEST(1.0, ha.avg_health_score))                                      AS avg_general_health_score,
          ha.num_health_records,
          ia.total_incidents,
          ia.num_severe_incidents,
          pa.total_plans,
          pa.pct_plans_achieved,
          pa.active_plan_count
        FROM residents r
        LEFT JOIN safehouses s ON s.safehouse_id = r.safehouse_id
        CROSS JOIN session_agg  sa
        CROSS JOIN edu_agg      ea
        CROSS JOIN health_agg   ha
        CROSS JOIN incident_agg ia
        CROSS JOIN plan_agg     pa
        WHERE r.resident_id = @ResidentId
        """;

    [HttpGet("reintegration-readiness/cohort")]
    public async Task<IActionResult> GetReintegrationReadinessCohort(CancellationToken ct)
    {
        List<ResidentCohortRow> residents;
        try
        {
            residents = await (
                from resident in db.Residents.AsNoTracking()
                where resident.CaseStatus == "Active"
                join safehouse in db.Safehouses.AsNoTracking()
                    on resident.SafehouseId equals safehouse.SafehouseId into safehouseJoin
                from safehouse in safehouseJoin.DefaultIfEmpty()
                orderby resident.InternalCode
                select new ResidentCohortRow(
                    resident.ResidentId,
                    resident.CaseControlNo,
                    resident.InternalCode,
                    resident.SafehouseId,
                    safehouse != null ? safehouse.Name : null,
                    resident.CaseStatus,
                    resident.CaseCategory,
                    resident.Sex,
                    resident.AssignedSocialWorker,
                    resident.DateOfAdmission,
                    resident.ReintegrationStatus,
                    resident.ReintegrationType,
                    resident.PresentAge,
                    resident.LengthOfStay,
                    resident.CurrentRiskLevel))
                .ToListAsync(ct);
        }
        catch (Exception ex)
        {
            return Problem(detail: $"Failed to load resident cohort: {ex.Message}", statusCode: 500);
        }

        var results = new List<ReintegrationCohortResidentResponse>(residents.Count);
        var failedCount = 0;
        string? firstFailure = null;

        foreach (var resident in residents)
        {
            if (ct.IsCancellationRequested)
                break;

            try
            {
                var featureRow = await LoadFeatureRowAsync((int)resident.Id, ct);
                if (featureRow is null)
                {
                    failedCount++;
                    firstFailure ??= $"Resident {resident.Id} not found.";
                    continue;
                }

                var prediction = await PredictReintegrationAsync(MapFeaturesPayload(resident.Id, featureRow), ct);
                results.Add(new ReintegrationCohortResidentResponse(
                    Id: resident.Id,
                    CaseControlNo: resident.CaseControlNo,
                    InternalCode: resident.InternalCode,
                    SafehouseId: resident.SafehouseId,
                    SafehouseName: resident.SafehouseName,
                    CaseStatus: resident.CaseStatus,
                    CaseCategory: resident.CaseCategory,
                    Sex: resident.Sex,
                    AssignedSocialWorker: resident.AssignedSocialWorker,
                    DateOfAdmission: resident.DateOfAdmission?.ToString("yyyy-MM-dd"),
                    ReintegrationStatus: resident.ReintegrationStatus,
                    ReintegrationType: resident.ReintegrationType,
                    PresentAge: resident.PresentAge,
                    LengthOfStay: resident.LengthOfStay,
                    CurrentRiskLevel: resident.CurrentRiskLevel,
                    Readiness: prediction));
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                failedCount++;
                firstFailure ??= ex.Message;
            }
        }

        if (results.Count == 0 && failedCount > 0)
            return Problem(detail: firstFailure ?? "Reintegration readiness cohort unavailable.", statusCode: 502);

        return Ok(new ReintegrationCohortResponse(results, failedCount));
    }

    // ── GET /api/residents/{residentId}/reintegration-readiness ───────────────

    [HttpGet("{residentId:int}/reintegration-readiness")]
    public async Task<IActionResult> GetReintegrationReadiness(int residentId, CancellationToken ct)
    {
        try
        {
            var row = await LoadFeatureRowAsync(residentId, ct);
            if (row is null)
                return NotFound(new { message = $"Resident {residentId} not found." });

            var prediction = await PredictReintegrationAsync(MapFeaturesPayload(residentId, row), ct);
            return Ok(prediction);
        }
        catch (Exception ex)
        {
            return Problem(detail: ex.Message, statusCode: ex is HttpRequestException ? 502 : 500);
        }
    }

    private async Task<dynamic?> LoadFeatureRowAsync(int residentId, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State == ConnectionState.Closed)
            await conn.OpenAsync(ct);

        try
        {
            return await conn.QueryFirstOrDefaultAsync<dynamic>(FeatureSql, new { ResidentId = residentId });
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"SQL error: {ex.Message}", ex);
        }
    }

    private static ReintegrationFeaturesPayload MapFeaturesPayload(int residentId, dynamic row) =>
        new(
            ResidentId: residentId,
            SafehouseId: (string)(row.safehouse_code ?? "Unknown"),
            AgeAtEntry: (int)ToDouble(row.age_at_entry, 15),
            DaysInProgram: (int)ToDouble(row.days_in_program, 0),
            ReferralSource: "Unknown",
            CurrentRiskLevel: (string)(row.current_risk_level ?? "Unknown"),
            ReintegrationType: (string)(row.reintegration_type ?? "Unknown"),
            CaseStatus: (string)(row.case_status ?? "Unknown"),
            TotalSessions: ToDouble(row.total_sessions, 0),
            PctProgressNoted: ToDouble(row.pct_progress_noted, 0),
            PctConcernsFlagged: ToDouble(row.pct_concerns_flagged, 0),
            LatestAttendanceRate: 0.0,
            AvgProgressPercent: ToDouble(row.avg_progress_percent, 0),
            AvgGeneralHealthScore: ToDouble(row.avg_general_health_score, 5),
            PctPsychCheckupDone: 0.0,
            NumHealthRecords: ToDouble(row.num_health_records, 0),
            TotalIncidents: ToDouble(row.total_incidents, 0),
            NumSevereIncidents: ToDouble(row.num_severe_incidents, 0),
            TotalPlans: ToDouble(row.total_plans, 0),
            PctPlansAchieved: ToDouble(row.pct_plans_achieved, 0),
            ActivePlanCount: ToDouble(row.active_plan_count, 0));

    private async Task<ReintegrationPredictionResponse> PredictReintegrationAsync(ReintegrationFeaturesPayload payload, CancellationToken ct)
    {
        var http = httpFactory.CreateClient("MlService");
        HttpResponseMessage response;
        try
        {
            response = await http.PostAsJsonAsync("/predict/reintegration-readiness", payload, ct);
        }
        catch (HttpRequestException ex)
        {
            throw new HttpRequestException($"ML service unavailable: {ex.Message}", ex);
        }

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"ML service error {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync(ct)}");

        var prediction = await response.Content.ReadFromJsonAsync<ReintegrationPredictionResponse>(ct);
        if (prediction is null)
            throw new InvalidOperationException("ML service returned an empty reintegration readiness response.");

        return prediction;
    }

    private static double ToDouble(dynamic? value, double fallback) =>
        value is null ? fallback : Convert.ToDouble(value);
}
