using System.Text.Json.Serialization;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace EbanHaven.Api.Controllers;

// ── DTOs ──────────────────────────────────────────────────────────────────────

file record SupporterFeaturesPayload(
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

file record ChurnPredictionResponse(
    [property: JsonPropertyName("supporter_id")]      int?         SupporterId,
    [property: JsonPropertyName("churn_probability")] double       ChurnProbability,
    [property: JsonPropertyName("prediction")]        string       Prediction,
    [property: JsonPropertyName("risk_tier")]         string       RiskTier,
    [property: JsonPropertyName("threshold_used")]    double       ThresholdUsed,
    [property: JsonPropertyName("top_risk_signals")]  List<string> TopRiskSignals
);

file record UpgradeFeaturePayload(
    [property: JsonPropertyName("supporter_id")]             int?   SupporterId,
    [property: JsonPropertyName("days_since_last_donation")] double DaysSinceLastDonation,
    [property: JsonPropertyName("total_donations")]          double TotalDonations,
    [property: JsonPropertyName("avg_amount")]               double AvgAmount,
    [property: JsonPropertyName("amount_trend")]             double AmountTrend,
    [property: JsonPropertyName("pct_recurring")]            double PctRecurring,
    [property: JsonPropertyName("num_campaigns")]            int    NumCampaigns,
    [property: JsonPropertyName("acquisition_channel")]      string AcquisitionChannel,
    [property: JsonPropertyName("relationship_type")]        string RelationshipType
);

file record UpgradePredictionResponse(
    [property: JsonPropertyName("supporter_id")]        int?         SupporterId,
    [property: JsonPropertyName("upgrade_probability")] double       UpgradeProbability,
    [property: JsonPropertyName("prediction")]          string       Prediction,
    [property: JsonPropertyName("propensity_tier")]     string       PropensityTier,
    [property: JsonPropertyName("threshold_used")]      double       ThresholdUsed,
    [property: JsonPropertyName("top_upgrade_signals")] List<string> TopUpgradeSignals
);

// ── Controller ────────────────────────────────────────────────────────────────

[ApiController]
[Route("api/donors")]
[Authorize]
public sealed class DonorChurnController : ControllerBase
{
    private readonly string _connStr;
    private readonly IHttpClientFactory _httpFactory;

    public DonorChurnController(IConfiguration config, IHttpClientFactory httpFactory)
    {
        _connStr = config.GetConnectionString("Supabase")
                   ?? config.GetConnectionString("SupaBaseConnection")
                   ?? throw new InvalidOperationException("Missing DB connection string");
        _httpFactory = httpFactory;
    }
    // Feature extraction for all supporters.
    // Tables: public.supporters (proper columns), public.donations (proper columns).
    // Only Monetary donations with a non-null amount contribute to financial features.
    private const string BatchFeatureSql = """
        WITH donation_data AS (
            SELECT
                d.supporter_id,
                d.donation_id,
                d.amount::float                           AS amount,
                d.donation_date::timestamp                AS donation_ts,
                d.is_recurring::bool                      AS is_recurring
            FROM donations d
            WHERE d.donation_type = 'Monetary'
              AND d.amount IS NOT NULL
        ),
        ranked AS (
            SELECT *,
                   ROW_NUMBER() OVER (PARTITION BY supporter_id ORDER BY donation_ts DESC) AS rn_desc,
                   ROW_NUMBER() OVER (PARTITION BY supporter_id ORDER BY donation_ts ASC)  AS rn_asc
            FROM donation_data
        ),
        aggs AS (
            SELECT
                supporter_id,
                COUNT(*)                                                                       AS total_donations,
                COALESCE(SUM(amount), 0.0)                                                     AS total_amount,
                COALESCE(AVG(amount), 0.0)                                                     AS avg_amount,
                COALESCE(MAX(amount), 0.0)                                                     AS max_amount,
                COALESCE(AVG(amount) FILTER (WHERE rn_desc <= 3), 0.0) -
                COALESCE(AVG(amount) FILTER (WHERE rn_asc  <= 3), 0.0)                        AS amount_trend,
                COALESCE(EXTRACT(EPOCH FROM (NOW() - MAX(donation_ts)))::int / 86400, 9999)   AS days_since_last_donation,
                COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(donation_ts)))::int / 86400, 0)      AS days_since_first_donation,
                COALESCE(AVG(CASE WHEN is_recurring THEN 1.0 ELSE 0.0 END), 0.0)             AS pct_recurring
            FROM ranked
            GROUP BY supporter_id
        )
        SELECT
            s.supporter_id,
            COALESCE(s.acquisition_channel, 'Unknown')                                        AS acquisition_channel,
            COALESCE(s.supporter_type,      'Unknown')                                        AS supporter_type,
            COALESCE(s.relationship_type,   'Unknown')                                        AS relationship_type,
            COALESCE(
                a.days_since_first_donation,
                CASE
                    WHEN s.first_donation_date IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (NOW() - s.first_donation_date::timestamp))::int / 86400
                    ELSE 0
                END,
                0
            )                                                                                AS days_since_joined,
            COALESCE(a.total_donations,          0)                                           AS total_donations,
            COALESCE(a.total_amount,             0.0)                                         AS total_amount,
            COALESCE(a.avg_amount,               0.0)                                         AS avg_amount,
            COALESCE(a.max_amount,               0.0)                                         AS max_amount,
            COALESCE(a.amount_trend,             0.0)                                         AS amount_trend,
            COALESCE(a.days_since_last_donation, 9999)                                        AS days_since_last_donation,
            COALESCE(a.days_since_first_donation,0)                                           AS days_since_first_donation,
            COALESCE(a.pct_recurring,            0.0)                                         AS pct_recurring,
            NULL::float                                                                        AS avg_days_between_donations
        FROM supporters s
        LEFT JOIN aggs a ON a.supporter_id = s.supporter_id
        ORDER BY COALESCE(a.days_since_last_donation, 9999) DESC
        """;

    private const string SingleFeatureSql = """
        WITH donation_data AS (
            SELECT
                d.supporter_id,
                d.donation_id,
                d.amount::float                           AS amount,
                d.donation_date::timestamp                AS donation_ts,
                d.is_recurring::bool                      AS is_recurring
            FROM donations d
            WHERE d.supporter_id = @SupporterId
              AND d.donation_type = 'Monetary'
              AND d.amount IS NOT NULL
        ),
        ranked AS (
            SELECT *,
                   ROW_NUMBER() OVER (ORDER BY donation_ts DESC) AS rn_desc,
                   ROW_NUMBER() OVER (ORDER BY donation_ts ASC)  AS rn_asc
            FROM donation_data
        )
        SELECT
            s.supporter_id,
            COALESCE(s.acquisition_channel, 'Unknown')                                        AS acquisition_channel,
            COALESCE(s.supporter_type,      'Unknown')                                        AS supporter_type,
            COALESCE(s.relationship_type,   'Unknown')                                        AS relationship_type,
            COALESCE(
                EXTRACT(EPOCH FROM (NOW() - MIN(r.donation_ts)))::int / 86400,
                CASE
                    WHEN s.first_donation_date IS NOT NULL
                        THEN EXTRACT(EPOCH FROM (NOW() - s.first_donation_date::timestamp))::int / 86400
                    ELSE 0
                END,
                0
            )                                                                                AS days_since_joined,
            COUNT(r.donation_id)                                                               AS total_donations,
            COALESCE(SUM(r.amount), 0.0)                                                      AS total_amount,
            COALESCE(AVG(r.amount), 0.0)                                                      AS avg_amount,
            COALESCE(MAX(r.amount), 0.0)                                                      AS max_amount,
            COALESCE(AVG(r.amount) FILTER (WHERE r.rn_desc <= 3), 0.0) -
            COALESCE(AVG(r.amount) FILTER (WHERE r.rn_asc  <= 3), 0.0)                       AS amount_trend,
            COALESCE(EXTRACT(EPOCH FROM (NOW() - MAX(r.donation_ts)))::int / 86400, 9999)    AS days_since_last_donation,
            COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(r.donation_ts)))::int / 86400, 0)       AS days_since_first_donation,
            COALESCE(AVG(CASE WHEN r.is_recurring THEN 1.0 ELSE 0.0 END), 0.0)              AS pct_recurring,
            NULL::float                                                                        AS avg_days_between_donations
        FROM supporters s
        LEFT JOIN ranked r ON r.supporter_id = s.supporter_id
        WHERE s.supporter_id = @SupporterId
        GROUP BY s.supporter_id, s.acquisition_channel, s.supporter_type, s.relationship_type, s.first_donation_date
        """;

    // ── GET /api/donors/at-risk ───────────────────────────────────────────────

    [HttpGet("at-risk")]
    public async Task<IActionResult> GetAtRisk(
        double threshold = 0.55,
        int limit = 25,
        CancellationToken ct = default)
    {
        try
        {
        await using var conn = new NpgsqlConnection(_connStr);
        await conn.OpenAsync(ct);
        var rows = (await conn.QueryAsync<dynamic>(BatchFeatureSql)).ToList();

        if (rows.Count == 0)
            return Ok(Array.Empty<ChurnPredictionResponse>());

        var payloads = rows.Select(r => new SupporterFeaturesPayload(
            SupporterId:             (int?)r.supporter_id,
            DaysSinceLastDonation:   ToDouble(r.days_since_last_donation,  9999),
            DaysSinceFirstDonation:  ToDouble(r.days_since_first_donation, 0),
            DaysSinceJoined:         ToDouble(r.days_since_joined,         0),
            TotalDonations:          ToDouble(r.total_donations,           0),
            PctRecurring:            ToDouble(r.pct_recurring,             0),
            AvgDaysBetweenDonations: null,
            TotalAmount:             ToDouble(r.total_amount,              0),
            AvgAmount:               ToDouble(r.avg_amount,                0),
            MaxAmount:               ToDouble(r.max_amount,                0),
            AmountTrend:             ToDouble(r.amount_trend,              0),
            AcquisitionChannel:      (string)(r.acquisition_channel ?? "Unknown"),
            SupporterType:           (string)(r.supporter_type      ?? "Unknown"),
            RelationshipType:        (string)(r.relationship_type   ?? "Unknown")
        )).ToList();

        var http = _httpFactory.CreateClient("MlService");
        HttpResponseMessage mlResponse;
        try
        {
            mlResponse = await http.PostAsJsonAsync("/predict/donor-churn-batch", payloads, ct);
        }
        catch (HttpRequestException ex)
        {
            return Problem(detail: $"ML service unavailable: {ex.Message}", statusCode: 502);
        }

        if (!mlResponse.IsSuccessStatusCode)
            return Problem(detail: await mlResponse.Content.ReadAsStringAsync(ct),
                           statusCode: (int)mlResponse.StatusCode);

        var predictions = await mlResponse.Content
            .ReadFromJsonAsync<List<ChurnPredictionResponse>>(ct);

        var atRisk = predictions!
            .Where(p => p.ChurnProbability >= threshold)
            .OrderByDescending(p => p.ChurnProbability)
            .Take(limit)
            .ToList();

        return Ok(atRisk);
        }
        catch (Exception ex)
        {
            return Problem(detail: ex.Message, statusCode: 500);
        }
    }

    // ── GET /api/donors/{supporterId}/churn-risk ──────────────────────────────

    [HttpGet("{supporterId:int}/churn-risk")]
    public async Task<IActionResult> GetChurnRisk(int supporterId, CancellationToken ct)
    {
        try
        {
        await using var conn = new NpgsqlConnection(_connStr);
        await conn.OpenAsync(ct);
        var row = await conn.QueryFirstOrDefaultAsync<dynamic>(
            SingleFeatureSql, new { SupporterId = supporterId });

        if (row is null)
            return NotFound(new { message = $"Supporter {supporterId} not found." });

        var payload = new SupporterFeaturesPayload(
            SupporterId:             supporterId,
            DaysSinceLastDonation:   ToDouble(row.days_since_last_donation,  9999),
            DaysSinceFirstDonation:  ToDouble(row.days_since_first_donation, 0),
            DaysSinceJoined:         ToDouble(row.days_since_joined,         0),
            TotalDonations:          ToDouble(row.total_donations,           0),
            PctRecurring:            ToDouble(row.pct_recurring,             0),
            AvgDaysBetweenDonations: null,
            TotalAmount:             ToDouble(row.total_amount,              0),
            AvgAmount:               ToDouble(row.avg_amount,                0),
            MaxAmount:               ToDouble(row.max_amount,                0),
            AmountTrend:             ToDouble(row.amount_trend,              0),
            AcquisitionChannel:      (string)(row.acquisition_channel ?? "Unknown"),
            SupporterType:           (string)(row.supporter_type      ?? "Unknown"),
            RelationshipType:        (string)(row.relationship_type   ?? "Unknown")
        );

        var http = _httpFactory.CreateClient("MlService");
        HttpResponseMessage mlResponse;
        try
        {
            mlResponse = await http.PostAsJsonAsync("/predict/donor-churn", payload, ct);
        }
        catch (HttpRequestException ex)
        {
            return Problem(detail: $"ML service unavailable: {ex.Message}", statusCode: 502);
        }

        if (!mlResponse.IsSuccessStatusCode)
            return Problem(detail: await mlResponse.Content.ReadAsStringAsync(ct),
                           statusCode: (int)mlResponse.StatusCode);

        var prediction = await mlResponse.Content.ReadFromJsonAsync<ChurnPredictionResponse>(ct);
        return Ok(prediction);
        }
        catch (Exception ex)
        {
            return Problem(detail: ex.Message, statusCode: 500);
        }
    }

    // ── GET /api/donors/upgrade-candidates ──────────────────────────────────────

    private const string UpgradeFeatureSql = """
        WITH donation_data AS (
            SELECT
                d.supporter_id,
                d.amount::float                           AS amount,
                d.donation_date::timestamp                AS donation_ts,
                d.is_recurring::bool                      AS is_recurring,
                d.campaign_name
            FROM donations d
            WHERE d.donation_type = 'Monetary'
              AND d.amount IS NOT NULL
        ),
        ranked AS (
            SELECT *,
                   ROW_NUMBER() OVER (PARTITION BY supporter_id ORDER BY donation_ts DESC) AS rn_desc,
                   ROW_NUMBER() OVER (PARTITION BY supporter_id ORDER BY donation_ts ASC)  AS rn_asc
            FROM donation_data
        ),
        aggs AS (
            SELECT
                supporter_id,
                COUNT(*)                                                                       AS total_donations,
                COALESCE(AVG(amount), 0.0)                                                     AS avg_amount,
                COALESCE(AVG(amount) FILTER (WHERE rn_desc <= 3), 0.0) -
                COALESCE(AVG(amount) FILTER (WHERE rn_asc  <= 3), 0.0)                        AS amount_trend,
                COALESCE(EXTRACT(EPOCH FROM (NOW() - MAX(donation_ts)))::int / 86400, 9999)   AS days_since_last_donation,
                COALESCE(AVG(CASE WHEN is_recurring THEN 1.0 ELSE 0.0 END), 0.0)             AS pct_recurring,
                COUNT(DISTINCT campaign_name) FILTER (WHERE campaign_name IS NOT NULL)         AS num_campaigns
            FROM ranked
            GROUP BY supporter_id
        )
        SELECT
            s.supporter_id,
            COALESCE(s.acquisition_channel, 'Unknown')                                        AS acquisition_channel,
            COALESCE(s.relationship_type,   'Unknown')                                        AS relationship_type,
            COALESCE(a.total_donations,          0)                                            AS total_donations,
            COALESCE(a.avg_amount,               0.0)                                          AS avg_amount,
            COALESCE(a.amount_trend,             0.0)                                          AS amount_trend,
            COALESCE(a.days_since_last_donation, 9999)                                         AS days_since_last_donation,
            COALESCE(a.pct_recurring,            0.0)                                          AS pct_recurring,
            COALESCE(a.num_campaigns,            0)                                            AS num_campaigns
        FROM supporters s
        LEFT JOIN aggs a ON a.supporter_id = s.supporter_id
        ORDER BY COALESCE(a.avg_amount, 0.0) DESC
        """;

    [HttpGet("upgrade-candidates")]
    public async Task<IActionResult> GetUpgradeCandidates(
        double threshold = 0.4,
        int limit = 100,
        CancellationToken ct = default)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State == ConnectionState.Closed)
            await conn.OpenAsync(ct);
        var rows = (await conn.QueryAsync<dynamic>(UpgradeFeatureSql)).ToList();

        if (rows.Count == 0)
            return Ok(Array.Empty<UpgradePredictionResponse>());

        var payloads = rows.Select(r => new UpgradeFeaturePayload(
            SupporterId:            (int?)r.supporter_id,
            DaysSinceLastDonation:  ToDouble(r.days_since_last_donation, 9999),
            TotalDonations:         ToDouble(r.total_donations,          0),
            AvgAmount:              ToDouble(r.avg_amount,               0),
            AmountTrend:            ToDouble(r.amount_trend,             0),
            PctRecurring:           ToDouble(r.pct_recurring,            0),
            NumCampaigns:           (int)ToDouble(r.num_campaigns,       0),
            AcquisitionChannel:     (string)(r.acquisition_channel ?? "Unknown"),
            RelationshipType:       (string)(r.relationship_type   ?? "Unknown")
        )).ToList();

        var http = httpFactory.CreateClient("MlService");
        HttpResponseMessage response;
        try
        {
            response = await http.PostAsJsonAsync("/predict/donor-upgrade-propensity-batch", payloads, ct);
        }
        catch (HttpRequestException ex)
        {
            return Problem(detail: $"ML service unavailable: {ex.Message}", statusCode: 502);
        }

        if (!response.IsSuccessStatusCode)
            return Problem(detail: await response.Content.ReadAsStringAsync(ct),
                           statusCode: (int)response.StatusCode);

        var predictions = await response.Content
            .ReadFromJsonAsync<List<UpgradePredictionResponse>>(ct);

        var candidates = predictions!
            .Where(p => p.UpgradeProbability >= threshold)
            .OrderByDescending(p => p.UpgradeProbability)
            .Take(limit)
            .ToList();

        return Ok(candidates);
    }

    private static double ToDouble(dynamic? value, double fallback) =>
        value is null ? fallback : Convert.ToDouble(value);
}
