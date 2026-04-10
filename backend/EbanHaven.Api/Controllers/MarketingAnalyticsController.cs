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

record EffectivenessRankingRow(
    [property: JsonPropertyName("label")]                     string  Label,
    [property: JsonPropertyName("postCount")]                 int     PostCount,
    [property: JsonPropertyName("medianRevenuePerPostPhp")]   decimal MedianRevenuePerPostPhp,
    [property: JsonPropertyName("medianDonationReferrals")]   decimal MedianDonationReferrals,
    [property: JsonPropertyName("medianRevenuePerThousandReachPhp")] decimal MedianRevenuePerThousandReachPhp,
    [property: JsonPropertyName("medianClickThroughRatePct")] decimal MedianClickThroughRatePct
);

record MarketingEffectivenessSummary(
    [property: JsonPropertyName("platforms")]     IEnumerable<EffectivenessRankingRow> Platforms,
    [property: JsonPropertyName("daysOfWeek")]    IEnumerable<EffectivenessRankingRow> DaysOfWeek,
    [property: JsonPropertyName("contentTopics")] IEnumerable<EffectivenessRankingRow> ContentTopics,
    [property: JsonPropertyName("recurringHashtags")] IEnumerable<EffectivenessRankingRow> RecurringHashtags,
    [property: JsonPropertyName("campaignHashtags")]  IEnumerable<EffectivenessRankingRow> CampaignHashtags
);

file record MarketingAnalyticsSummary(
    [property: JsonPropertyName("campaigns")]             IEnumerable<CampaignPerformanceRow> Campaigns,
    [property: JsonPropertyName("channels")]              IEnumerable<ChannelAttributionRow>  Channels,
    [property: JsonPropertyName("socialMediaSpotlight")]  SocialMediaSpotlight                SocialMediaSpotlight,
    [property: JsonPropertyName("effectiveness")]         MarketingEffectivenessSummary       Effectiveness,
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
    private sealed record SocialWindowSpec(string Key, string Label, DateTimeOffset? StartUtc, DateTimeOffset? EndUtc);

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

    private const string PlatformEffectivenessSql = """
        SELECT
            COALESCE(platform, 'Unknown') AS label,
            COUNT(*)::int AS post_count,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(estimated_donation_value_php, 0))::numeric, 2) AS median_revenue_per_post_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(donation_referrals, 0))::numeric, 2) AS median_donation_referrals,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN COALESCE(reach, 0) > 0
                THEN 1000.0 * COALESCE(estimated_donation_value_php, 0) / reach
                ELSE 0 END)::numeric, 2) AS median_revenue_per_thousand_reach_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN COALESCE(reach, 0) > 0
                THEN 100.0 * COALESCE(click_throughs, 0) / reach
                ELSE 0 END)::numeric, 2) AS median_click_through_rate_pct
        FROM social_media_posts
        GROUP BY COALESCE(platform, 'Unknown')
        ORDER BY median_revenue_per_post_php DESC, post_count DESC
        """;

    private const string DayOfWeekEffectivenessSql = """
        SELECT
            COALESCE(day_of_week, 'Unknown') AS label,
            COUNT(*)::int AS post_count,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(estimated_donation_value_php, 0))::numeric, 2) AS median_revenue_per_post_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(donation_referrals, 0))::numeric, 2) AS median_donation_referrals,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN COALESCE(reach, 0) > 0
                THEN 1000.0 * COALESCE(estimated_donation_value_php, 0) / reach
                ELSE 0 END)::numeric, 2) AS median_revenue_per_thousand_reach_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN COALESCE(reach, 0) > 0
                THEN 100.0 * COALESCE(click_throughs, 0) / reach
                ELSE 0 END)::numeric, 2) AS median_click_through_rate_pct
        FROM social_media_posts
        GROUP BY COALESCE(day_of_week, 'Unknown')
        ORDER BY median_revenue_per_post_php DESC, post_count DESC
        """;

    private const string ContentTopicEffectivenessSql = """
        SELECT
            COALESCE(content_topic, 'Unknown') AS label,
            COUNT(*)::int AS post_count,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(estimated_donation_value_php, 0))::numeric, 2) AS median_revenue_per_post_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(donation_referrals, 0))::numeric, 2) AS median_donation_referrals,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN COALESCE(reach, 0) > 0
                THEN 1000.0 * COALESCE(estimated_donation_value_php, 0) / reach
                ELSE 0 END)::numeric, 2) AS median_revenue_per_thousand_reach_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN COALESCE(reach, 0) > 0
                THEN 100.0 * COALESCE(click_throughs, 0) / reach
                ELSE 0 END)::numeric, 2) AS median_click_through_rate_pct
        FROM social_media_posts
        GROUP BY COALESCE(content_topic, 'Unknown')
        ORDER BY median_revenue_per_post_php DESC, post_count DESC
        """;

    private const string RecurringHashtagEffectivenessSql = """
        WITH exploded AS (
            SELECT
                LOWER(TRIM(tag)) AS label,
                COALESCE(estimated_donation_value_php, 0) AS estimated_donation_value_php,
                COALESCE(donation_referrals, 0) AS donation_referrals,
                COALESCE(reach, 0) AS reach,
                COALESCE(click_throughs, 0) AS click_throughs
            FROM social_media_posts
            CROSS JOIN LATERAL regexp_split_to_table(COALESCE(hashtags, ''), '\s*,\s*') AS tag
            WHERE NULLIF(TRIM(tag), '') IS NOT NULL
              AND NULLIF(TRIM(COALESCE(campaign_name, '')), '') IS NULL
        )
        SELECT
            label,
            COUNT(*)::int AS post_count,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY estimated_donation_value_php)::numeric, 2) AS median_revenue_per_post_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY donation_referrals)::numeric, 2) AS median_donation_referrals,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN reach > 0
                THEN 1000.0 * estimated_donation_value_php / reach
                ELSE 0 END)::numeric, 2) AS median_revenue_per_thousand_reach_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN reach > 0
                THEN 100.0 * click_throughs / reach
                ELSE 0 END)::numeric, 2) AS median_click_through_rate_pct
        FROM exploded
        GROUP BY label
        HAVING COUNT(*) >= 20
        ORDER BY median_revenue_per_post_php DESC, post_count DESC
        LIMIT 12
        """;

    private const string CampaignHashtagEffectivenessSql = """
        WITH exploded AS (
            SELECT
                LOWER(TRIM(tag)) AS label,
                COALESCE(estimated_donation_value_php, 0) AS estimated_donation_value_php,
                COALESCE(donation_referrals, 0) AS donation_referrals,
                COALESCE(reach, 0) AS reach,
                COALESCE(click_throughs, 0) AS click_throughs
            FROM social_media_posts
            CROSS JOIN LATERAL regexp_split_to_table(COALESCE(hashtags, ''), '\s*,\s*') AS tag
            WHERE NULLIF(TRIM(tag), '') IS NOT NULL
              AND NULLIF(TRIM(COALESCE(campaign_name, '')), '') IS NOT NULL
        )
        SELECT
            label,
            COUNT(*)::int AS post_count,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY estimated_donation_value_php)::numeric, 2) AS median_revenue_per_post_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY donation_referrals)::numeric, 2) AS median_donation_referrals,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN reach > 0
                THEN 1000.0 * estimated_donation_value_php / reach
                ELSE 0 END)::numeric, 2) AS median_revenue_per_thousand_reach_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN reach > 0
                THEN 100.0 * click_throughs / reach
                ELSE 0 END)::numeric, 2) AS median_click_through_rate_pct
        FROM exploded
        GROUP BY label
        HAVING COUNT(*) >= 15
        ORDER BY median_revenue_per_post_php DESC, post_count DESC
        LIMIT 12
        """;

    private static IReadOnlyList<EffectivenessRankingRow> BuildEffectivenessRows(IEnumerable<dynamic> rows, int take = 8)
    {
        var raw = rows.Select(r => new
        {
            Label = (string)(r.label ?? "Unknown"),
            PostCount = (int)(r.post_count ?? 0),
            MedianRevenuePerPostPhp = (decimal)(r.median_revenue_per_post_php ?? 0m),
            MedianDonationReferrals = (decimal)(r.median_donation_referrals ?? 0m),
            MedianRevenuePerThousandReachPhp = (decimal)(r.median_revenue_per_thousand_reach_php ?? 0m),
            MedianClickThroughRatePct = (decimal)(r.median_click_through_rate_pct ?? 0m),
        }).ToList();

        if (raw.Count == 0)
            return [];

        return raw
            .Select(x =>
                new EffectivenessRankingRow(
                    Label: x.Label,
                    PostCount: x.PostCount,
                    MedianRevenuePerPostPhp: x.MedianRevenuePerPostPhp,
                    MedianDonationReferrals: x.MedianDonationReferrals,
                    MedianRevenuePerThousandReachPhp: x.MedianRevenuePerThousandReachPhp,
                    MedianClickThroughRatePct: x.MedianClickThroughRatePct
                ))
            .OrderByDescending(x => x.MedianRevenuePerPostPhp)
            .ThenByDescending(x => x.MedianDonationReferrals)
            .ThenByDescending(x => x.PostCount)
            .Take(take)
            .ToArray();
    }

    private static SocialWindowSpec ResolveSocialWindow(string? socialWindow)
    {
        var now = DateTimeOffset.UtcNow;
        var normalized = socialWindow?.Trim().ToLowerInvariant();

        return normalized switch
        {
            "day" or "today" => new("day", "Today", now.Date, now.Date.AddDays(1)),
            "month" or "this-month" => new("month", "This Month", new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero), new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero).AddMonths(1)),
            "year" or "this-year" => new("year", "This Year", new DateTimeOffset(now.Year, 1, 1, 0, 0, 0, TimeSpan.Zero), new DateTimeOffset(now.Year + 1, 1, 1, 0, 0, 0, TimeSpan.Zero)),
            "last30" or "last-30-days" => new("last30", "Last 30 Days", now.AddDays(-30), now),
            "last90" or "last-90-days" => new("last90", "Last 90 Days", now.AddDays(-90), now),
            _ => new("all", "All Time", null, null),
        };
    }

    private static object BuildSocialWindowParams(SocialWindowSpec window) => new
    {
        WindowStartUtc = window.StartUtc?.UtcDateTime,
        WindowEndUtc = window.EndUtc?.UtcDateTime,
    };

    private static string DonationWindowClause(SocialWindowSpec window) =>
        window.StartUtc is null ? string.Empty : "AND donation_date >= @WindowStartUtc AND donation_date < @WindowEndUtc";

    private static string SupporterWindowClause(SocialWindowSpec window) =>
        window.StartUtc is null ? string.Empty : "AND COALESCE(s.first_donation_date::timestamp, s.created_at::timestamp) >= @WindowStartUtc AND COALESCE(s.first_donation_date::timestamp, s.created_at::timestamp) < @WindowEndUtc";

    private static string SocialPostWindowClause(SocialWindowSpec window, string prefix = "WHERE") =>
        window.StartUtc is null ? string.Empty : $"{prefix} created_at >= @WindowStartUtc AND created_at < @WindowEndUtc";

    private static string BuildSocialSpotlightSql(SocialWindowSpec window) =>
        $$"""
        SELECT
            COUNT(*)::int AS social_count,
            ROUND(COALESCE(SUM(amount), 0)::numeric, 2) AS social_total,
            ROUND(COALESCE(AVG(amount), 0)::numeric, 2) AS social_avg,
            ROUND(
                100.0 * COALESCE(SUM(CASE WHEN is_recurring THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0), 0), 1
            ) AS social_recurring_pct,
            COUNT(DISTINCT supporter_id)::int AS social_unique_donors
        FROM donations
        WHERE donation_type = 'Monetary'
          AND amount IS NOT NULL
          AND amount > 0
          AND channel_source = 'SocialMedia'
          {{DonationWindowClause(window)}}
        """;

    private static string BuildSocialAcquiredSql(SocialWindowSpec window) =>
        $$"""
        SELECT
            COUNT(DISTINCT s.supporter_id)::int AS acquired_donors,
            ROUND(AVG(ltv.total_amount)::numeric, 2) AS avg_ltv_acquired
        FROM supporters s
        JOIN (
            SELECT supporter_id, SUM(amount) AS total_amount
            FROM donations
            WHERE donation_type = 'Monetary' AND amount IS NOT NULL AND amount > 0
            GROUP BY supporter_id
        ) ltv ON ltv.supporter_id = s.supporter_id
        WHERE s.acquisition_channel = 'SocialMedia'
          {{SupporterWindowClause(window)}}
        """;

    private static string BuildPlatformEffectivenessSql(SocialWindowSpec window) =>
        $$"""
        SELECT
            COALESCE(platform, 'Unknown') AS label,
            COUNT(*)::int AS post_count,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(estimated_donation_value_php, 0))::numeric, 2) AS median_revenue_per_post_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(donation_referrals, 0))::numeric, 2) AS median_donation_referrals,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN COALESCE(reach, 0) > 0
                THEN 1000.0 * COALESCE(estimated_donation_value_php, 0) / reach
                ELSE 0 END)::numeric, 2) AS median_revenue_per_thousand_reach_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN COALESCE(reach, 0) > 0
                THEN 100.0 * COALESCE(click_throughs, 0) / reach
                ELSE 0 END)::numeric, 2) AS median_click_through_rate_pct
        FROM social_media_posts
        {{SocialPostWindowClause(window)}}
        GROUP BY COALESCE(platform, 'Unknown')
        ORDER BY median_revenue_per_post_php DESC, post_count DESC
        """;

    private static string BuildDayOfWeekEffectivenessSql(SocialWindowSpec window) =>
        $$"""
        SELECT
            COALESCE(day_of_week, 'Unknown') AS label,
            COUNT(*)::int AS post_count,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(estimated_donation_value_php, 0))::numeric, 2) AS median_revenue_per_post_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(donation_referrals, 0))::numeric, 2) AS median_donation_referrals,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN COALESCE(reach, 0) > 0
                THEN 1000.0 * COALESCE(estimated_donation_value_php, 0) / reach
                ELSE 0 END)::numeric, 2) AS median_revenue_per_thousand_reach_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN COALESCE(reach, 0) > 0
                THEN 100.0 * COALESCE(click_throughs, 0) / reach
                ELSE 0 END)::numeric, 2) AS median_click_through_rate_pct
        FROM social_media_posts
        {{SocialPostWindowClause(window)}}
        GROUP BY COALESCE(day_of_week, 'Unknown')
        ORDER BY median_revenue_per_post_php DESC, post_count DESC
        """;

    private static string BuildContentTopicEffectivenessSql(SocialWindowSpec window) =>
        $$"""
        SELECT
            COALESCE(content_topic, 'Unknown') AS label,
            COUNT(*)::int AS post_count,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(estimated_donation_value_php, 0))::numeric, 2) AS median_revenue_per_post_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(donation_referrals, 0))::numeric, 2) AS median_donation_referrals,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN COALESCE(reach, 0) > 0
                THEN 1000.0 * COALESCE(estimated_donation_value_php, 0) / reach
                ELSE 0 END)::numeric, 2) AS median_revenue_per_thousand_reach_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN COALESCE(reach, 0) > 0
                THEN 100.0 * COALESCE(click_throughs, 0) / reach
                ELSE 0 END)::numeric, 2) AS median_click_through_rate_pct
        FROM social_media_posts
        {{SocialPostWindowClause(window)}}
        GROUP BY COALESCE(content_topic, 'Unknown')
        ORDER BY median_revenue_per_post_php DESC, post_count DESC
        """;

    private static string BuildRecurringHashtagEffectivenessSql(SocialWindowSpec window) =>
        $$"""
        WITH exploded AS (
            SELECT
                LOWER(TRIM(tag)) AS label,
                COALESCE(estimated_donation_value_php, 0) AS estimated_donation_value_php,
                COALESCE(donation_referrals, 0) AS donation_referrals,
                COALESCE(reach, 0) AS reach,
                COALESCE(click_throughs, 0) AS click_throughs
            FROM social_media_posts
            CROSS JOIN LATERAL regexp_split_to_table(COALESCE(hashtags, ''), '\s*,\s*') AS tag
            {{SocialPostWindowClause(window)}}
              AND NULLIF(TRIM(tag), '') IS NOT NULL
              AND NULLIF(TRIM(COALESCE(campaign_name, '')), '') IS NULL
        )
        SELECT
            label,
            COUNT(*)::int AS post_count,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY estimated_donation_value_php)::numeric, 2) AS median_revenue_per_post_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY donation_referrals)::numeric, 2) AS median_donation_referrals,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN reach > 0
                THEN 1000.0 * estimated_donation_value_php / reach
                ELSE 0 END)::numeric, 2) AS median_revenue_per_thousand_reach_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN reach > 0
                THEN 100.0 * click_throughs / reach
                ELSE 0 END)::numeric, 2) AS median_click_through_rate_pct
        FROM exploded
        GROUP BY label
        HAVING COUNT(*) >= 20
        ORDER BY median_revenue_per_post_php DESC, post_count DESC
        LIMIT 12
        """;

    private static string BuildCampaignHashtagEffectivenessSql(SocialWindowSpec window) =>
        $$"""
        WITH exploded AS (
            SELECT
                LOWER(TRIM(tag)) AS label,
                COALESCE(estimated_donation_value_php, 0) AS estimated_donation_value_php,
                COALESCE(donation_referrals, 0) AS donation_referrals,
                COALESCE(reach, 0) AS reach,
                COALESCE(click_throughs, 0) AS click_throughs
            FROM social_media_posts
            CROSS JOIN LATERAL regexp_split_to_table(COALESCE(hashtags, ''), '\s*,\s*') AS tag
            {{SocialPostWindowClause(window)}}
              AND NULLIF(TRIM(tag), '') IS NOT NULL
              AND NULLIF(TRIM(COALESCE(campaign_name, '')), '') IS NOT NULL
        )
        SELECT
            label,
            COUNT(*)::int AS post_count,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY estimated_donation_value_php)::numeric, 2) AS median_revenue_per_post_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY donation_referrals)::numeric, 2) AS median_donation_referrals,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN reach > 0
                THEN 1000.0 * estimated_donation_value_php / reach
                ELSE 0 END)::numeric, 2) AS median_revenue_per_thousand_reach_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY CASE WHEN reach > 0
                THEN 100.0 * click_throughs / reach
                ELSE 0 END)::numeric, 2) AS median_click_through_rate_pct
        FROM exploded
        GROUP BY label
        HAVING COUNT(*) >= 15
        ORDER BY median_revenue_per_post_php DESC, post_count DESC
        LIMIT 12
        """;

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(string socialWindow = "all", CancellationToken ct = default)
    {
        var window = ResolveSocialWindow(socialWindow);
        var windowParams = BuildSocialWindowParams(window);
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

        var spot    = await conn.QuerySingleAsync<dynamic>(BuildSocialSpotlightSql(window), windowParams);
        var ltvRow  = await conn.QuerySingleAsync<dynamic>(AvgLtvSql);
        var acqRow  = await conn.QuerySingleOrDefaultAsync<dynamic>(BuildSocialAcquiredSql(window), windowParams);

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

        IReadOnlyList<EffectivenessRankingRow> platforms = [];
        IReadOnlyList<EffectivenessRankingRow> daysOfWeek = [];
        IReadOnlyList<EffectivenessRankingRow> contentTopics = [];
        IReadOnlyList<EffectivenessRankingRow> recurringHashtags = [];
        IReadOnlyList<EffectivenessRankingRow> campaignHashtags = [];
        try
        {
            platforms = BuildEffectivenessRows(await conn.QueryAsync<dynamic>(BuildPlatformEffectivenessSql(window), windowParams), take: 7);
            daysOfWeek = BuildEffectivenessRows(await conn.QueryAsync<dynamic>(BuildDayOfWeekEffectivenessSql(window), windowParams), take: 7);
            contentTopics = BuildEffectivenessRows(await conn.QueryAsync<dynamic>(BuildContentTopicEffectivenessSql(window), windowParams), take: 8);
            recurringHashtags = BuildEffectivenessRows(await conn.QueryAsync<dynamic>(BuildRecurringHashtagEffectivenessSql(window), windowParams), take: 8);
            campaignHashtags = BuildEffectivenessRows(await conn.QueryAsync<dynamic>(BuildCampaignHashtagEffectivenessSql(window), windowParams), take: 8);
        }
        catch
        {
            // Social media posts table may not be present/populated in some environments yet.
            // Keep the rest of the marketing dashboard available.
        }

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
            Effectiveness:        new MarketingEffectivenessSummary(
                Platforms: platforms,
                DaysOfWeek: daysOfWeek,
                ContentTopics: contentTopics,
                RecurringHashtags: recurringHashtags,
                CampaignHashtags: campaignHashtags
            ),
            CausalEstimates:      causalEstimates,
            LastAnalysisRun:      lastAnalysisRun
        ));
    }
}
