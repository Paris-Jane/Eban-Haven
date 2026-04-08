using System.Data;
using System.Text.Json.Serialization;
using Dapper;
using EbanHaven.Api.DataAccess;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EbanHaven.Api.Controllers;

// ── DTOs ──────────────────────────────────────────────────────────────────────

file record CampaignPerformanceRow(
    [property: JsonPropertyName("campaignName")]    string  CampaignName,
    [property: JsonPropertyName("donationCount")]   int     DonationCount,
    [property: JsonPropertyName("uniqueDonors")]    int     UniqueDonors,
    [property: JsonPropertyName("totalPhp")]        decimal TotalPhp,
    [property: JsonPropertyName("avgAmount")]       decimal AvgAmount,
    [property: JsonPropertyName("maxAmount")]       decimal MaxAmount,
    [property: JsonPropertyName("recurringPct")]    decimal RecurringPct,
    [property: JsonPropertyName("firstDonation")]   string  FirstDonation,
    [property: JsonPropertyName("lastDonation")]    string  LastDonation
);

file record ChannelAttributionRow(
    [property: JsonPropertyName("channelSource")]         string  ChannelSource,
    [property: JsonPropertyName("uniqueDonors")]          int     UniqueDonors,
    [property: JsonPropertyName("totalDonations")]        int     TotalDonations,
    [property: JsonPropertyName("totalPhp")]              decimal TotalPhp,
    [property: JsonPropertyName("avgDonorLtv")]           decimal AvgDonorLtv,
    [property: JsonPropertyName("avgDonationAmount")]     decimal AvgDonationAmount,
    [property: JsonPropertyName("avgDonationsPerDonor")]  decimal AvgDonationsPerDonor,
    [property: JsonPropertyName("pctRecurringDonors")]    decimal PctRecurringDonors
);

file record SocialMediaSpotlight(
    [property: JsonPropertyName("donationCount")]          int      DonationCount,
    [property: JsonPropertyName("totalPhp")]               decimal  TotalPhp,
    [property: JsonPropertyName("avgAmount")]              decimal  AvgAmount,
    [property: JsonPropertyName("recurringPct")]           decimal  RecurringPct,
    [property: JsonPropertyName("uniqueDonors")]           int      UniqueDonors,
    [property: JsonPropertyName("acquiredDonors")]         int      AcquiredDonors,
    [property: JsonPropertyName("avgLtvAcquiredPhp")]      decimal? AvgLtvAcquiredPhp,
    [property: JsonPropertyName("avgLtvAllDonorsPhp")]     decimal  AvgLtvAllDonorsPhp
);

file record MarketingAnalyticsSummary(
    [property: JsonPropertyName("campaigns")]             IEnumerable<CampaignPerformanceRow> Campaigns,
    [property: JsonPropertyName("channels")]              IEnumerable<ChannelAttributionRow>  Channels,
    [property: JsonPropertyName("socialMediaSpotlight")]  SocialMediaSpotlight                SocialMediaSpotlight,
    [property: JsonPropertyName("causalEstimates")]       object?                             CausalEstimates,
    [property: JsonPropertyName("lastAnalysisRun")]       string?                             LastAnalysisRun
);

// ── Controller ────────────────────────────────────────────────────────────────

[ApiController]
[Route("api/marketing")]
[Authorize]
public sealed class MarketingAnalyticsController(
    HavenDbContext db,
    IHttpClientFactory httpFactory
) : ControllerBase
{
    private static double ToDouble(object? v, double fallback = 0) =>
        v is null or DBNull ? fallback : Convert.ToDouble(v);

    private const string CampaignSql = """
        SELECT
            COALESCE(campaign_name, 'No Campaign')                                        AS campaign_name,
            COUNT(*)::int                                                                  AS donation_count,
            COUNT(DISTINCT supporter_id)::int                                              AS unique_donors,
            ROUND(SUM(amount)::numeric, 2)                                                 AS total_php,
            ROUND(AVG(amount)::numeric, 2)                                                 AS avg_amount,
            ROUND(MAX(amount)::numeric, 2)                                                 AS max_amount,
            ROUND(100.0 * SUM(CASE WHEN is_recurring THEN 1 ELSE 0 END)::numeric
                  / NULLIF(COUNT(*), 0), 1)                                                AS recurring_pct,
            MIN(donation_date)::date::text                                                 AS first_donation,
            MAX(donation_date)::date::text                                                 AS last_donation
        FROM donations
        WHERE donation_type = 'Monetary'
          AND amount IS NOT NULL
          AND amount > 0
        GROUP BY COALESCE(campaign_name, 'No Campaign')
        ORDER BY total_php DESC
        """;

    private const string ChannelSql = """
        WITH donor_channel AS (
            SELECT
                channel_source,
                supporter_id,
                SUM(amount)::float              AS lifetime_value,
                COUNT(*)                        AS donation_count,
                AVG(amount)::float              AS avg_donation,
                BOOL_OR(is_recurring)           AS has_recurring
            FROM donations
            WHERE donation_type = 'Monetary'
              AND amount IS NOT NULL
              AND amount > 0
            GROUP BY channel_source, supporter_id
        )
        SELECT
            COALESCE(channel_source, 'Unknown')                              AS channel_source,
            COUNT(DISTINCT supporter_id)::int                                AS unique_donors,
            SUM(donation_count)::int                                         AS total_donations,
            ROUND(SUM(lifetime_value)::numeric, 2)                           AS total_php,
            ROUND(AVG(lifetime_value)::numeric, 2)                           AS avg_donor_ltv,
            ROUND(AVG(avg_donation)::numeric, 2)                             AS avg_donation_amount,
            ROUND(AVG(donation_count)::numeric, 2)                           AS avg_donations_per_donor,
            ROUND(100.0 * SUM(CASE WHEN has_recurring THEN 1 ELSE 0 END)::numeric
                  / NULLIF(COUNT(*), 0), 1)                                  AS pct_recurring_donors
        FROM donor_channel
        GROUP BY COALESCE(channel_source, 'Unknown')
        ORDER BY total_php DESC
        """;

    // Social spotlight: metrics for the SocialMedia channel_source
    private const string SocialSpotlightSql = """
        SELECT
            SUM(CASE WHEN channel_source = 'SocialMedia' THEN 1 ELSE 0 END)::int             AS social_count,
            ROUND(SUM(CASE WHEN channel_source = 'SocialMedia' THEN amount ELSE 0 END)::numeric, 2)
                                                                                               AS social_total,
            ROUND(AVG(CASE WHEN channel_source = 'SocialMedia' THEN amount END)::numeric, 2)  AS social_avg,
            ROUND(
                100.0 * SUM(CASE WHEN channel_source = 'SocialMedia' AND is_recurring THEN 1 ELSE 0 END)::numeric
                / NULLIF(SUM(CASE WHEN channel_source = 'SocialMedia' THEN 1 ELSE 0 END), 0), 1)
                                                                                               AS social_recurring_pct,
            COUNT(DISTINCT CASE WHEN channel_source = 'SocialMedia' THEN supporter_id END)::int
                                                                                               AS social_unique_donors
        FROM donations
        WHERE donation_type = 'Monetary'
          AND amount IS NOT NULL
          AND amount > 0
        """;

    // Average LTV across all donors
    private const string AvgLtvSql = """
        SELECT ROUND(AVG(total_amount)::numeric, 2) AS avg_ltv
        FROM (
            SELECT supporter_id, SUM(amount) AS total_amount
            FROM donations
            WHERE donation_type = 'Monetary' AND amount IS NOT NULL AND amount > 0
            GROUP BY supporter_id
        ) t
        """;

    // Donors acquired via SocialMedia + their avg LTV
    private const string SocialAcquiredSql = """
        SELECT
            COUNT(DISTINCT s.supporter_id)::int                          AS acquired_donors,
            ROUND(AVG(ltv.total_amount)::numeric, 2)                     AS avg_ltv_acquired
        FROM supporters s
        JOIN (
            SELECT supporter_id, SUM(amount) AS total_amount
            FROM donations
            WHERE donation_type = 'Monetary' AND amount IS NOT NULL AND amount > 0
            GROUP BY supporter_id
        ) ltv ON ltv.supporter_id = s.supporter_id
        WHERE s.acquisition_channel = 'SocialMedia'
        """;

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var conn = db.Database.GetDbConnection();
        if (conn.State == ConnectionState.Closed)
            await conn.OpenAsync(ct);

        var campaigns = (await conn.QueryAsync<dynamic>(CampaignSql)).Select(r =>
            new CampaignPerformanceRow(
                CampaignName:  (string)r.campaign_name,
                DonationCount: (int)r.donation_count,
                UniqueDonors:  (int)r.unique_donors,
                TotalPhp:      (decimal)r.total_php,
                AvgAmount:     (decimal)r.avg_amount,
                MaxAmount:     (decimal)r.max_amount,
                RecurringPct:  (decimal)(r.recurring_pct ?? 0m),
                FirstDonation: (string)r.first_donation,
                LastDonation:  (string)r.last_donation
            )).ToList();

        var channels = (await conn.QueryAsync<dynamic>(ChannelSql)).Select(r =>
            new ChannelAttributionRow(
                ChannelSource:        (string)r.channel_source,
                UniqueDonors:         (int)r.unique_donors,
                TotalDonations:       (int)r.total_donations,
                TotalPhp:             (decimal)r.total_php,
                AvgDonorLtv:          (decimal)r.avg_donor_ltv,
                AvgDonationAmount:    (decimal)r.avg_donation_amount,
                AvgDonationsPerDonor: (decimal)r.avg_donations_per_donor,
                PctRecurringDonors:   (decimal)(r.pct_recurring_donors ?? 0m)
            )).ToList();

        var spot    = await conn.QuerySingleAsync<dynamic>(SocialSpotlightSql);
        var ltvRow  = await conn.QuerySingleAsync<dynamic>(AvgLtvSql);
        var acqRow  = await conn.QuerySingleOrDefaultAsync<dynamic>(SocialAcquiredSql);

        var spotlight = new SocialMediaSpotlight(
            DonationCount:      (int)(spot.social_count      ?? 0),
            TotalPhp:           (decimal)(spot.social_total   ?? 0m),
            AvgAmount:          (decimal)(spot.social_avg     ?? 0m),
            RecurringPct:       (decimal)(spot.social_recurring_pct ?? 0m),
            UniqueDonors:       (int)(spot.social_unique_donors ?? 0),
            AcquiredDonors:     acqRow != null ? (int)(acqRow.acquired_donors ?? 0) : 0,
            AvgLtvAcquiredPhp:  acqRow != null ? (decimal?)(acqRow.avg_ltv_acquired) : null,
            AvgLtvAllDonorsPhp: (decimal)(ltvRow.avg_ltv ?? 0m)
        );

        // Attempt to fetch causal estimates from Python ML service
        object? causalEstimates = null;
        string? lastAnalysisRun = null;
        try
        {
            var client   = httpFactory.CreateClient("MlService");
            var response = await client.GetAsync("/marketing/campaign-analysis", ct);
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync(ct);
                using var doc = System.Text.Json.JsonDocument.Parse(json);
                causalEstimates = System.Text.Json.JsonSerializer.Deserialize<object>(json);
                if (doc.RootElement.TryGetProperty("last_run", out var lr))
                    lastAnalysisRun = lr.GetString();
            }
        }
        catch
        {
            // ML service unavailable — surface live metrics without causal estimates
        }

        return Ok(new MarketingAnalyticsSummary(
            Campaigns:            campaigns,
            Channels:             channels,
            SocialMediaSpotlight: spotlight,
            CausalEstimates:      causalEstimates,
            LastAnalysisRun:      lastAnalysisRun
        ));
    }
}
