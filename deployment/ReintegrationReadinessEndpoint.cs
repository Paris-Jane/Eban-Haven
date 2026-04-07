// ReintegrationReadinessEndpoint.cs
// Place this file in your .NET 10 Web API project.
//
// Required NuGet packages:
//   Dapper
//   Microsoft.Extensions.Http
//
// appsettings.json entry:
//   "PredictionService": { "BaseUrl": "http://localhost:8001" }
//
// In Program.cs:
//   builder.Services.AddReintegrationReadiness(builder.Configuration);
//   ...
//   app.MapReintegrationReadiness();

using System.Text.Json;
using System.Text.Json.Serialization;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace YourApp.Features.Reintegration;

// ── Records ───────────────────────────────────────────────────────────────────

public record ResidentFeaturesPayload(
    [property: JsonPropertyName("resident_id")]             int?   ResidentId,
    [property: JsonPropertyName("safehouse_id")]            string SafehouseId,
    [property: JsonPropertyName("age_at_entry")]            int    AgeAtEntry,
    [property: JsonPropertyName("days_in_program")]         int    DaysInProgram,
    [property: JsonPropertyName("referral_source")]         string ReferralSource,
    [property: JsonPropertyName("total_sessions")]          double TotalSessions,
    [property: JsonPropertyName("pct_progress_noted")]      double PctProgressNoted,
    [property: JsonPropertyName("pct_concerns_flagged")]    double PctConcernsFlagged,
    [property: JsonPropertyName("latest_attendance_rate")]  double LatestAttendanceRate,
    [property: JsonPropertyName("avg_progress_percent")]    double AvgProgressPercent,
    [property: JsonPropertyName("avg_general_health_score")] double AvgGeneralHealthScore,
    [property: JsonPropertyName("pct_psych_checkup_done")]  double PctPsychCheckupDone,
    [property: JsonPropertyName("num_health_records")]      double NumHealthRecords,
    [property: JsonPropertyName("total_incidents")]         double TotalIncidents,
    [property: JsonPropertyName("num_severe_incidents")]    double NumSevereIncidents,
    [property: JsonPropertyName("total_plans")]             double TotalPlans,
    [property: JsonPropertyName("pct_plans_achieved")]      double PctPlansAchieved
);

public record ReintegrationPredictionResponse(
    [property: JsonPropertyName("resident_id")]                   int?   ResidentId,
    [property: JsonPropertyName("reintegration_probability")]     double ReintegrationProbability,
    [property: JsonPropertyName("prediction")]                    string Prediction,
    [property: JsonPropertyName("risk_tier")]                     string RiskTier,
    [property: JsonPropertyName("threshold_used")]                double ThresholdUsed
);

// ── DI Registration ───────────────────────────────────────────────────────────

public static class ReintegrationServiceExtensions
{
    public static IServiceCollection AddReintegrationReadiness(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services
            .AddHttpClient("PredictionService", client =>
            {
                var baseUrl = configuration["PredictionService:BaseUrl"]
                    ?? "http://localhost:8001";
                client.BaseAddress = new Uri(baseUrl);
                client.Timeout = TimeSpan.FromSeconds(10);
            });

        return services;
    }

    public static WebApplication MapReintegrationReadiness(this WebApplication app)
    {
        app.MapGet(
            "/api/residents/{residentId:int}/reintegration-readiness",
            ReintegrationReadinessEndpoint.HandleAsync)
            .WithName("GetReintegrationReadiness")
            .WithTags("Case Management")
            .WithSummary("Predict reintegration readiness for a resident")
            .Produces<ReintegrationPredictionResponse>(200)
            .Produces(404)
            .Produces(502);

        return app;
    }
}

// ── Endpoint Handler ──────────────────────────────────────────────────────────

public static class ReintegrationReadinessEndpoint
{
    // SQL that mirrors the feature engineering in the Python notebook.
    // All aggregations are computed over pre-outcome data only (no date_closed, no case_status).
    // Written for PostgreSQL (Supabase / Npgsql) — NOT compatible with MSSQL.
    //
    // Schema note: all lighthouse_* tables store their fields as a `data jsonb` blob.
    // Fields are accessed with the ->>/::cast pattern (e.g. r.data->>'age_at_entry').
    // Field names confirmed from LighthouseDataStore.cs + lighthouseSupabase.ts.
    private const string FeatureQuery = """
        SELECT
            r.resident_id,

            -- Resident base fields (all inside data jsonb)
            COALESCE(NULLIF(TRIM(r.data->>'age_at_entry'), '')::int, 0)              AS age_at_entry,
            r.data->>'safehouse_id'                                                   AS safehouse_id,
            r.data->>'referral_source'                                                AS referral_source,
            COALESCE(
                EXTRACT(EPOCH FROM (
                    NOW() - TO_TIMESTAMP(TRIM(r.data->>'date_of_admission'), 'YYYY-MM-DD')
                ))::int / 86400,
                0
            )                                                                         AS days_in_program,

            -- process_recordings: progress_noted and concerns_flagged are 'True'/'False' strings
            COUNT(DISTINCT pr.recording_id)                                           AS total_sessions,
            AVG(CASE WHEN LOWER(TRIM(pr.data->>'progress_noted'))  = 'true' THEN 1.0 ELSE 0.0 END)
                                                                                      AS pct_progress_noted,
            AVG(CASE WHEN LOWER(TRIM(pr.data->>'concerns_flagged')) = 'true' THEN 1.0 ELSE 0.0 END)
                                                                                      AS pct_concerns_flagged,

            -- education_records: latest by record_seq desc, average progress_percent
            (SELECT NULLIF(TRIM(e2.data->>'attendance_rate'), '')::float
             FROM lighthouse_education_records e2
             WHERE NULLIF(TRIM(e2.data->>'resident_id'), '')::int = r.resident_id
             ORDER BY NULLIF(TRIM(e2.data->>'record_seq'), '')::int DESC NULLS LAST
             LIMIT 1)                                                                  AS latest_attendance_rate,
            AVG(NULLIF(TRIM(er.data->>'progress_percent'), '')::float)               AS avg_progress_percent,

            -- health_wellbeing_records
            AVG(NULLIF(TRIM(hw.data->>'general_health_score'), '')::float)           AS avg_general_health_score,
            AVG(CASE WHEN LOWER(TRIM(hw.data->>'psychological_checkup_done')) = 'true' THEN 1.0 ELSE 0.0 END)
                                                                                      AS pct_psych_checkup_done,
            COUNT(hw.health_record_id)                                               AS num_health_records,

            -- Incident proxy: no separate incidents table; use flagged process recording sessions
            -- total_incidents  = sessions where concerns were flagged
            -- num_severe_incidents = 0 (no severity field available in this schema)
            COUNT(pr.recording_id) FILTER (
                WHERE LOWER(TRIM(pr.data->>'concerns_flagged')) = 'true'
            )                                                                         AS total_incidents,
            0                                                                         AS num_severe_incidents,

            -- intervention_plans: status field matches 'Achieved' / 'In Progress' / 'Not Achieved'
            COUNT(ip.plan_id)                                                         AS total_plans,
            AVG(CASE WHEN LOWER(TRIM(ip.data->>'status')) = 'achieved' THEN 1.0 ELSE 0.0 END)
                                                                                      AS pct_plans_achieved

        FROM lighthouse_residents r
        LEFT JOIN lighthouse_process_recordings       pr ON NULLIF(TRIM(pr.data->>'resident_id'), '')::int = r.resident_id
        LEFT JOIN lighthouse_education_records        er ON NULLIF(TRIM(er.data->>'resident_id'), '')::int = r.resident_id
        LEFT JOIN lighthouse_health_wellbeing_records hw ON NULLIF(TRIM(hw.data->>'resident_id'), '')::int = r.resident_id
        LEFT JOIN lighthouse_intervention_plans       ip ON NULLIF(TRIM(ip.data->>'resident_id'), '')::int = r.resident_id
        WHERE r.resident_id = @ResidentId
        GROUP BY
            r.resident_id,
            r.data->>'safehouse_id',
            r.data->>'age_at_entry',
            r.data->>'date_of_admission',
            r.data->>'referral_source'
        """;

    public static async Task<IResult> HandleAsync(
        int residentId,
        [FromServices] IDbConnectionFactory dbFactory,
        [FromServices] IHttpClientFactory httpFactory,
        CancellationToken ct)
    {
        // 1. Query feature aggregations from DB
        await using var db = await dbFactory.CreateAsync(ct);
        var row = await db.QueryFirstOrDefaultAsync<dynamic>(
            FeatureQuery, new { ResidentId = residentId });

        if (row is null)
            return Results.NotFound(new { message = $"Resident {residentId} not found." });

        // 2. Build payload
        var payload = new ResidentFeaturesPayload(
            ResidentId:            residentId,
            SafehouseId:           row.safehouse_id ?? "Unknown",
            AgeAtEntry:            row.age_at_entry ?? 0,
            DaysInProgram:         row.days_in_program ?? 0,
            ReferralSource:        row.referral_source ?? "Unknown",
            TotalSessions:         row.total_sessions ?? 0.0,
            PctProgressNoted:      row.pct_progress_noted ?? 0.0,
            PctConcernsFlagged:    row.pct_concerns_flagged ?? 0.0,
            LatestAttendanceRate:  row.latest_attendance_rate ?? 0.0,
            AvgProgressPercent:    row.avg_progress_percent ?? 0.0,
            AvgGeneralHealthScore: row.avg_general_health_score ?? 5.0,
            PctPsychCheckupDone:   row.pct_psych_checkup_done ?? 0.0,
            NumHealthRecords:      row.num_health_records ?? 0.0,
            TotalIncidents:        row.total_incidents ?? 0.0,
            NumSevereIncidents:    row.num_severe_incidents ?? 0.0,
            TotalPlans:            row.total_plans ?? 0.0,
            PctPlansAchieved:      row.pct_plans_achieved ?? 0.0
        );

        // 3. Call Python prediction service
        var http = httpFactory.CreateClient("PredictionService");

        HttpResponseMessage response;
        try
        {
            response = await http.PostAsJsonAsync("/predict", payload, ct);
        }
        catch (HttpRequestException ex)
        {
            return Results.Problem(
                detail: $"Prediction service unavailable: {ex.Message}",
                statusCode: 502);
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            return Results.Problem(detail: body, statusCode: (int)response.StatusCode);
        }

        var prediction = await response.Content
            .ReadFromJsonAsync<ReintegrationPredictionResponse>(ct);

        return Results.Ok(prediction);
    }
}

// ── IDbConnectionFactory (Npgsql / PostgreSQL implementation) ─────────────────
//
// 1. Add the Npgsql NuGet package:
//      dotnet add package Npgsql
//
// 2. Add the connection string to your Azure App Service environment variables
//    (or appsettings.json for local dev):
//
//    "ConnectionStrings": {
//      "Default": "Host=db.xxxx.supabase.co;Database=postgres;Username=postgres;Password=YOUR_PASSWORD;SSL Mode=Require;Trust Server Certificate=true"
//    }
//
// 3. Register in Program.cs:
//    builder.Services.AddReintegrationReadiness(builder.Configuration);
//    builder.Services.AddSingleton<IDbConnectionFactory>(
//        new NpgsqlConnectionFactory(builder.Configuration.GetConnectionString("Default")!));
//    ...
//    app.MapReintegrationReadiness();

using Npgsql;

public class NpgsqlConnectionFactory(string connectionString) : IDbConnectionFactory
{
    public async Task<System.Data.IDbConnection> CreateAsync(CancellationToken ct)
    {
        var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(ct);
        return conn;
    }
}

public interface IDbConnectionFactory
{
    Task<System.Data.IDbConnection> CreateAsync(CancellationToken ct);
}
