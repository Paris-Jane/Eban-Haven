// DonorChurnEndpoint.cs
// Place this file in your .NET 10 Web API project alongside ReintegrationReadinessEndpoint.cs
//
// Required NuGet packages (same as the reintegration endpoint):
//   Dapper
//   Npgsql
//   Microsoft.Extensions.Http
//
// appsettings.json entry:
//   "ChurnService": { "BaseUrl": "http://localhost:8002" }
//
// In Program.cs:
//   builder.Services.AddDonorChurn(builder.Configuration);
//   ...
//   app.MapDonorChurn();

using System.Text.Json;
using System.Text.Json.Serialization;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace YourApp.Features.DonorChurn;

// ── Records ───────────────────────────────────────────────────────────────────

public record SupporterFeaturesPayload(
    [property: JsonPropertyName("supporter_id")]               int?    SupporterId,
    [property: JsonPropertyName("days_since_last_donation")]   double  DaysSinceLastDonation,
    [property: JsonPropertyName("days_since_first_donation")]  double  DaysSinceFirstDonation,
    [property: JsonPropertyName("days_since_joined")]          double  DaysSinceJoined,
    [property: JsonPropertyName("total_donations")]            double  TotalDonations,
    [property: JsonPropertyName("pct_recurring")]              double  PctRecurring,
    [property: JsonPropertyName("avg_days_between_donations")] double? AvgDaysBetweenDonations,
    [property: JsonPropertyName("total_amount")]               double  TotalAmount,
    [property: JsonPropertyName("avg_amount")]                 double  AvgAmount,
    [property: JsonPropertyName("max_amount")]                 double  MaxAmount,
    [property: JsonPropertyName("amount_trend")]               double  AmountTrend,
    [property: JsonPropertyName("acquisition_channel")]        string  AcquisitionChannel,
    [property: JsonPropertyName("supporter_type")]             string  SupporterType,
    [property: JsonPropertyName("relationship_type")]          string  RelationshipType
);

public record ChurnPredictionResponse(
    [property: JsonPropertyName("supporter_id")]      int?         SupporterId,
    [property: JsonPropertyName("churn_probability")] double       ChurnProbability,
    [property: JsonPropertyName("prediction")]        string       Prediction,
    [property: JsonPropertyName("risk_tier")]         string       RiskTier,
    [property: JsonPropertyName("threshold_used")]    double       ThresholdUsed,
    [property: JsonPropertyName("top_risk_signals")]  List<string> TopRiskSignals
);

// ── DI Registration ───────────────────────────────────────────────────────────

public static class DonorChurnServiceExtensions
{
    public static IServiceCollection AddDonorChurn(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services
            .AddHttpClient("ChurnService", client =>
            {
                var baseUrl = configuration["ChurnService:BaseUrl"] ?? "http://localhost:8002";
                client.BaseAddress = new Uri(baseUrl);
                client.Timeout     = TimeSpan.FromSeconds(30); // batch calls can take longer
            });

        return services;
    }

    public static WebApplication MapDonorChurn(this WebApplication app)
    {
        // Batch at-risk list (used by the dashboard component)
        app.MapGet(
            "/api/donors/at-risk",
            DonorChurnEndpoint.HandleAtRiskListAsync)
            .WithName("GetAtRiskDonors")
            .WithTags("Donor Management")
            .WithSummary("Return donors ranked by churn probability above a threshold")
            .Produces<List<ChurnPredictionResponse>>(200)
            .Produces(502);

        // Single-donor lookup
        app.MapGet(
            "/api/donors/{supporterId:int}/churn-risk",
            DonorChurnEndpoint.HandleSingleAsync)
            .WithName("GetDonorChurnRisk")
            .WithTags("Donor Management")
            .WithSummary("Get churn risk for a single donor")
            .Produces<ChurnPredictionResponse>(200)
            .Produces(404)
            .Produces(502);

        return app;
    }
}

// ── Endpoint Handler ──────────────────────────────────────────────────────────

public static class DonorChurnEndpoint
{
    // ── SQL: batch feature extraction for ALL active supporters ──────────────
    // Schema note: lighthouse_supporters and lighthouse_donations store fields
    // inside a `data jsonb` blob (confirmed from LighthouseDataStore.cs).
    // Boolean fields (is_recurring) are stored as 'True'/'False' strings.
    // Dates stored as 'YYYY-MM-DD' strings inside jsonb.
    //
    // amount_trend is approximated as (avg of 3 most recent donations) minus
    // (avg of 3 earliest donations). A full linear regression slope requires
    // a separate aggregation step not easily expressible in this single SQL.
    // The model handles this approximate signal gracefully via imputation.
    private const string BatchFeatureQuery = """
        WITH donation_data AS (
            SELECT
                NULLIF(TRIM(d.data->>'supporter_id'), '')::int          AS supporter_id,
                d.donation_id,
                NULLIF(TRIM(d.data->>'amount'), '')::float              AS amount,
                TO_TIMESTAMP(TRIM(d.data->>'donation_date'), 'YYYY-MM-DD') AS donation_ts,
                LOWER(TRIM(d.data->>'is_recurring')) = 'true'           AS is_recurring
            FROM lighthouse_donations d
            -- Only Monetary donations have a PHP amount; Time/InKind/Skills donations do not
            WHERE NULLIF(TRIM(d.data->>'supporter_id'), '') IS NOT NULL
              AND LOWER(TRIM(d.data->>'donation_type')) = 'monetary'
              AND NULLIF(TRIM(d.data->>'amount'), '') IS NOT NULL
        ),
        ranked_donations AS (
            SELECT *,
                   ROW_NUMBER() OVER (PARTITION BY supporter_id ORDER BY donation_ts DESC) AS rn_desc,
                   ROW_NUMBER() OVER (PARTITION BY supporter_id ORDER BY donation_ts ASC)  AS rn_asc
            FROM donation_data
        ),
        donation_aggs AS (
            SELECT
                supporter_id,
                COUNT(*)                                                                AS total_donations,
                COALESCE(SUM(amount), 0.0)                                              AS total_amount,
                COALESCE(AVG(amount), 0.0)                                              AS avg_amount,
                COALESCE(MAX(amount), 0.0)                                              AS max_amount,
                COALESCE(AVG(amount::float) FILTER (WHERE rn_desc <= 3), 0.0) -
                COALESCE(AVG(amount::float) FILTER (WHERE rn_asc  <= 3), 0.0)          AS amount_trend,
                COALESCE(EXTRACT(EPOCH FROM (
                    NOW() - MAX(donation_ts)
                ))::int / 86400, 9999)                                                  AS days_since_last_donation,
                COALESCE(EXTRACT(EPOCH FROM (
                    NOW() - MIN(donation_ts)
                ))::int / 86400, 0)                                                     AS days_since_first_donation,
                COALESCE(AVG(CASE WHEN is_recurring THEN 1.0 ELSE 0.0 END), 0.0)      AS pct_recurring
            FROM ranked_donations
            GROUP BY supporter_id
        )
        SELECT
            s.supporter_id,
            COALESCE(s.data->>'acquisition_channel', 'Unknown')         AS acquisition_channel,
            COALESCE(s.data->>'supporter_type',      'Unknown')         AS supporter_type,
            COALESCE(s.data->>'relationship_type',   'Unknown')         AS relationship_type,
            -- Real field is created_at (confirmed from supporters.csv schema)
            COALESCE(EXTRACT(EPOCH FROM (
                NOW() - TO_TIMESTAMP(TRIM(s.data->>'created_at'), 'YYYY-MM-DD HH24:MI:SS')
            ))::int / 86400, 0)                                         AS days_since_joined,
            COALESCE(da.total_donations,          0)                    AS total_donations,
            COALESCE(da.total_amount,             0.0)                  AS total_amount,
            COALESCE(da.avg_amount,               0.0)                  AS avg_amount,
            COALESCE(da.max_amount,               0.0)                  AS max_amount,
            COALESCE(da.amount_trend,             0.0)                  AS amount_trend,
            COALESCE(da.days_since_last_donation, 9999)                 AS days_since_last_donation,
            COALESCE(da.days_since_first_donation,0)                    AS days_since_first_donation,
            COALESCE(da.pct_recurring,            0.0)                  AS pct_recurring,
            NULL                                                         AS avg_days_between_donations
        FROM lighthouse_supporters s
        LEFT JOIN donation_aggs da ON da.supporter_id = s.supporter_id
        ORDER BY days_since_last_donation DESC
        """;

    // Single-supporter variant (add WHERE clause)
    private const string SingleFeatureQuery =
        BatchFeatureQuery.Replace("ORDER BY days_since_last_donation DESC",
                                  "WHERE s.supporter_id = @SupporterId\nORDER BY 1");
    // Note: The replace above is a simplification; in production use a parameterized CTE.
    // For robustness, duplicate the query with the WHERE clause inside the CTE instead.

    // ── Batch handler ─────────────────────────────────────────────────────────
    public static async Task<IResult> HandleAtRiskListAsync(
        [FromServices] IDbConnectionFactory dbFactory,
        [FromServices] IHttpClientFactory httpFactory,
        double threshold = 0.55,
        int limit = 25,
        CancellationToken ct = default)
    {
        await using var db = await dbFactory.CreateAsync(ct);
        var rows = (await db.QueryAsync<dynamic>(BatchFeatureQuery)).ToList();

        if (rows.Count == 0)
            return Results.Ok(Array.Empty<ChurnPredictionResponse>());

        var payloads = rows.Select(r => new SupporterFeaturesPayload(
            SupporterId:              (int?)r.supporter_id,
            DaysSinceLastDonation:    (double)(r.days_since_last_donation ?? 9999),
            DaysSinceFirstDonation:   (double)(r.days_since_first_donation ?? 0),
            DaysSinceJoined:          (double)(r.days_since_joined ?? 0),
            TotalDonations:           (double)(r.total_donations ?? 0),
            PctRecurring:             (double)(r.pct_recurring ?? 0),
            AvgDaysBetweenDonations:  null,
            TotalAmount:              (double)(r.total_amount ?? 0),
            AvgAmount:                (double)(r.avg_amount ?? 0),
            MaxAmount:                (double)(r.max_amount ?? 0),
            AmountTrend:              (double)(r.amount_trend ?? 0),
            AcquisitionChannel:       (string)(r.acquisition_channel ?? "Unknown"),
            SupporterType:            (string)(r.supporter_type ?? "Individual"),
            RelationshipType:         (string)(r.relationship_type ?? "One-time")
        )).ToList();

        var http = httpFactory.CreateClient("ChurnService");

        HttpResponseMessage response;
        try
        {
            response = await http.PostAsJsonAsync("/predict-batch", payloads, ct);
        }
        catch (HttpRequestException ex)
        {
            return Results.Problem(
                detail: $"Churn prediction service unavailable: {ex.Message}",
                statusCode: 502);
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            return Results.Problem(detail: body, statusCode: (int)response.StatusCode);
        }

        var predictions = await response.Content
            .ReadFromJsonAsync<List<ChurnPredictionResponse>>(ct);

        var atRisk = predictions!
            .Where(p => p.ChurnProbability >= threshold)
            .OrderByDescending(p => p.ChurnProbability)
            .Take(limit)
            .ToList();

        return Results.Ok(atRisk);
    }

    // ── Single-donor handler ──────────────────────────────────────────────────
    public static async Task<IResult> HandleSingleAsync(
        int supporterId,
        [FromServices] IDbConnectionFactory dbFactory,
        [FromServices] IHttpClientFactory httpFactory,
        CancellationToken ct)
    {
        await using var db = await dbFactory.CreateAsync(ct);

        // Inline single-supporter query (avoids the replace hack above)
        const string singleSql = """
            WITH donation_data AS (
                SELECT
                    NULLIF(TRIM(d.data->>'supporter_id'), '')::int       AS supporter_id,
                    d.donation_id,
                    NULLIF(TRIM(d.data->>'amount'), '')::float            AS amount,
                    TO_TIMESTAMP(TRIM(d.data->>'donation_date'), 'YYYY-MM-DD') AS donation_ts,
                    LOWER(TRIM(d.data->>'is_recurring')) = 'true'         AS is_recurring
                FROM lighthouse_donations d
                WHERE NULLIF(TRIM(d.data->>'supporter_id'), '')::int = @SupporterId
                  AND LOWER(TRIM(d.data->>'donation_type')) = 'monetary'
                  AND NULLIF(TRIM(d.data->>'amount'), '') IS NOT NULL
            ),
            ranked AS (
                SELECT *,
                       ROW_NUMBER() OVER (ORDER BY donation_ts DESC) AS rn_desc,
                       ROW_NUMBER() OVER (ORDER BY donation_ts ASC)  AS rn_asc
                FROM donation_data
            )
            SELECT
                s.supporter_id,
                COALESCE(s.data->>'acquisition_channel', 'Unknown')     AS acquisition_channel,
                COALESCE(s.data->>'supporter_type',      'Individual')  AS supporter_type,
                COALESCE(s.data->>'relationship_type',   'One-time')    AS relationship_type,
                COALESCE(EXTRACT(EPOCH FROM (
                    NOW() - TO_TIMESTAMP(TRIM(s.data->>'created_at'), 'YYYY-MM-DD HH24:MI:SS')
                ))::int / 86400, 0)                                     AS days_since_joined,
                COUNT(r.donation_id)                                    AS total_donations,
                COALESCE(SUM(r.amount), 0.0)                            AS total_amount,
                COALESCE(AVG(r.amount), 0.0)                            AS avg_amount,
                COALESCE(MAX(r.amount), 0.0)                            AS max_amount,
                COALESCE(AVG(r.amount) FILTER (WHERE r.rn_desc <= 3), 0.0) -
                COALESCE(AVG(r.amount) FILTER (WHERE r.rn_asc  <= 3), 0.0) AS amount_trend,
                COALESCE(EXTRACT(EPOCH FROM (NOW() - MAX(r.donation_ts)))::int / 86400, 9999)
                                                                        AS days_since_last_donation,
                COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(r.donation_ts)))::int / 86400, 0)
                                                                        AS days_since_first_donation,
                COALESCE(AVG(CASE WHEN r.is_recurring THEN 1.0 ELSE 0.0 END), 0.0)
                                                                        AS pct_recurring
            FROM lighthouse_supporters s
            LEFT JOIN ranked r ON r.supporter_id = s.supporter_id
            WHERE s.supporter_id = @SupporterId
            GROUP BY s.supporter_id, s.data->>'acquisition_channel',
                     s.data->>'supporter_type', s.data->>'relationship_type', s.data->>'created_at'
            """;

        var row = await db.QueryFirstOrDefaultAsync<dynamic>(singleSql, new { SupporterId = supporterId });

        if (row is null)
            return Results.NotFound(new { message = $"Supporter {supporterId} not found." });

        var payload = new SupporterFeaturesPayload(
            SupporterId:             supporterId,
            DaysSinceLastDonation:   (double)(row.days_since_last_donation  ?? 9999),
            DaysSinceFirstDonation:  (double)(row.days_since_first_donation ?? 0),
            DaysSinceJoined:         (double)(row.days_since_joined         ?? 0),
            TotalDonations:          (double)(row.total_donations            ?? 0),
            PctRecurring:            (double)(row.pct_recurring              ?? 0),
            AvgDaysBetweenDonations: null,
            TotalAmount:             (double)(row.total_amount               ?? 0),
            AvgAmount:               (double)(row.avg_amount                 ?? 0),
            MaxAmount:               (double)(row.max_amount                 ?? 0),
            AmountTrend:             (double)(row.amount_trend               ?? 0),
            AcquisitionChannel:      (string)(row.acquisition_channel        ?? "Unknown"),
            SupporterType:           (string)(row.supporter_type             ?? "Individual"),
            RelationshipType:        (string)(row.relationship_type          ?? "One-time")
        );

        var http = httpFactory.CreateClient("ChurnService");
        HttpResponseMessage response;
        try
        {
            response = await http.PostAsJsonAsync("/predict", payload, ct);
        }
        catch (HttpRequestException ex)
        {
            return Results.Problem(detail: $"Churn service unavailable: {ex.Message}", statusCode: 502);
        }

        if (!response.IsSuccessStatusCode)
            return Results.Problem(detail: await response.Content.ReadAsStringAsync(ct),
                                   statusCode: (int)response.StatusCode);

        var prediction = await response.Content.ReadFromJsonAsync<ChurnPredictionResponse>(ct);
        return Results.Ok(prediction);
    }
}
