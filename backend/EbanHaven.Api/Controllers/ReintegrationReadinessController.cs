using System.Data;
using System.Text.Json.Serialization;
using Dapper;
using EbanHaven.Api.DataAccess;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EbanHaven.Api.Controllers;

// ── DTOs ──────────────────────────────────────────────────────────────────────

file record ReintegrationFeaturesPayload(
    [property: JsonPropertyName("resident_id")]              int    ResidentId,
    [property: JsonPropertyName("safehouse_id")]             string SafehouseId,
    [property: JsonPropertyName("age_at_entry")]             int    AgeAtEntry,
    [property: JsonPropertyName("days_in_program")]          int    DaysInProgram,
    [property: JsonPropertyName("referral_source")]          string ReferralSource,
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
    [property: JsonPropertyName("pct_plans_achieved")]       double PctPlansAchieved
);

file record ReintegrationPredictionResponse(
    [property: JsonPropertyName("resident_id")]               int?   ResidentId,
    [property: JsonPropertyName("reintegration_probability")] double ReintegrationProbability,
    [property: JsonPropertyName("prediction")]                string Prediction,
    [property: JsonPropertyName("risk_tier")]                 string RiskTier,
    [property: JsonPropertyName("threshold_used")]            double ThresholdUsed
);

// ── Controller ────────────────────────────────────────────────────────────────

[ApiController]
[Route("api/residents")]
[Authorize]
public sealed class ReintegrationReadinessController(HavenDbContext db, IHttpClientFactory httpFactory) : ControllerBase
{
    // Extracts the 16-feature vector expected by the Reintegration Readiness GBM.
    //
    // Column inventory (only EF-mapped columns are queried — optional migration columns
    // attendance_rate / psychological_checkup_done / age_upon_admission / referral_source
    // may not exist on all environments, so we use safe defaults for those features):
    //  residents          : resident_id, safehouse_id, date_of_admission, present_age
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
              CASE
                WHEN COUNT(*) = 0 THEN 0.0
                ELSE COUNT(*) FILTER (WHERE status ILIKE 'Achieved' OR status ILIKE 'Completed')::float / COUNT(*)::float
              END                                                                               AS pct_plans_achieved
            FROM intervention_plans
            WHERE resident_id = @ResidentId
          )
        SELECT
          r.resident_id,
          COALESCE(s.code, 'Unknown')                                                          AS safehouse_code,
          CASE
            WHEN r.present_age ~ '^\d+$'
              THEN LEAST(25, GREATEST(10, r.present_age::int))
            ELSE 15
          END                                                                                   AS age_at_entry,
          GREATEST(0,
            CASE
              WHEN r.date_of_admission IS NOT NULL AND r.date_of_admission ~ '^\d{4}-\d{2}-\d{2}'
                THEN EXTRACT(EPOCH FROM (NOW() - r.date_of_admission::date))::int / 86400
              ELSE 0
            END
          )                                                                                     AS days_in_program,
          sa.total_sessions,
          sa.pct_progress_noted,
          sa.pct_concerns_flagged,
          ea.avg_progress_percent,
          LEAST(10.0, GREATEST(1.0, ha.avg_health_score))                                      AS avg_general_health_score,
          ha.num_health_records,
          ia.total_incidents,
          ia.num_severe_incidents,
          pa.total_plans,
          pa.pct_plans_achieved
        FROM residents r
        LEFT JOIN safehouses s ON s.safehouse_id = r.safehouse_id
        CROSS JOIN session_agg  sa
        CROSS JOIN edu_agg      ea
        CROSS JOIN health_agg   ha
        CROSS JOIN incident_agg ia
        CROSS JOIN plan_agg     pa
        WHERE r.resident_id = @ResidentId
        """;

    // ── GET /api/residents/{residentId}/reintegration-readiness ───────────────

    [HttpGet("{residentId:int}/reintegration-readiness")]
    public async Task<IActionResult> GetReintegrationReadiness(int residentId, CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State == ConnectionState.Closed)
            await conn.OpenAsync(ct);

        var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
            FeatureSql, new { ResidentId = residentId });

        if (row is null)
            return NotFound(new { message = $"Resident {residentId} not found." });

        var payload = new ReintegrationFeaturesPayload(
            ResidentId:             residentId,
            SafehouseId:            (string)(row.safehouse_code ?? "Unknown"),
            AgeAtEntry:             (int)ToDouble(row.age_at_entry, 15),
            DaysInProgram:          (int)ToDouble(row.days_in_program, 0),
            ReferralSource:         "Unknown",          // column not in base schema; model uses as categorical default
            TotalSessions:          ToDouble(row.total_sessions, 0),
            PctProgressNoted:       ToDouble(row.pct_progress_noted, 0),
            PctConcernsFlagged:     ToDouble(row.pct_concerns_flagged, 0),
            LatestAttendanceRate:   0.0,                // attendance_rate column not in base schema; default = 0
            AvgProgressPercent:     ToDouble(row.avg_progress_percent, 0),
            AvgGeneralHealthScore:  ToDouble(row.avg_general_health_score, 5),
            PctPsychCheckupDone:    0.0,                // psychological_checkup_done column not in base schema; default = 0
            NumHealthRecords:       ToDouble(row.num_health_records, 0),
            TotalIncidents:         ToDouble(row.total_incidents, 0),
            NumSevereIncidents:     ToDouble(row.num_severe_incidents, 0),
            TotalPlans:             ToDouble(row.total_plans, 0),
            PctPlansAchieved:       ToDouble(row.pct_plans_achieved, 0)
        );

        var http = httpFactory.CreateClient("MlService");
        HttpResponseMessage response;
        try
        {
            response = await http.PostAsJsonAsync("/predict/reintegration-readiness", payload, ct);
        }
        catch (HttpRequestException ex)
        {
            return Problem(detail: $"ML service unavailable: {ex.Message}", statusCode: 502);
        }

        if (!response.IsSuccessStatusCode)
            return Problem(detail: await response.Content.ReadAsStringAsync(ct),
                           statusCode: (int)response.StatusCode);

        var prediction = await response.Content.ReadFromJsonAsync<ReintegrationPredictionResponse>(ct);
        return Ok(prediction);
    }

    private static double ToDouble(dynamic? value, double fallback) =>
        value is null ? fallback : Convert.ToDouble(value);
}
