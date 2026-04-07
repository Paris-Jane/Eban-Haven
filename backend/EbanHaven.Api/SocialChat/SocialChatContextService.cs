using EbanHaven.Api.Configuration;
using Microsoft.Extensions.Options;

namespace EbanHaven.Api.SocialChat;

public interface ISocialChatContextService
{
    Task<SocialChatContextSnapshot> BuildContextAsync(CancellationToken cancellationToken);
}

public sealed class SocialChatContextService(IOptions<SiteOptions> siteOptions) : ISocialChatContextService
{
    public async Task<SocialChatContextSnapshot> BuildContextAsync(CancellationToken cancellationToken)
    {
        var websiteSummary = await GetWebsiteSummaryAsync(cancellationToken);
        var brandGuidelines = await GetBrandGuidelinesAsync(cancellationToken);
        var recentSocialMetrics = await GetRecentSocialMetricsAsync(cancellationToken);
        var causalInsights = await GetCausalInsightsAsync(cancellationToken);

        return new SocialChatContextSnapshot(
            websiteSummary,
            brandGuidelines,
            recentSocialMetrics,
            causalInsights);
    }

    public Task<string> GetWebsiteSummaryAsync(CancellationToken cancellationToken)
    {
        var site = siteOptions.Value;
        var summary =
            $"{site.Name} is a nonprofit serving women and girls in Ghana affected by trafficking, sexual violence, " +
            "abuse, and related exploitation. The organization emphasizes safe shelter, counseling, education, " +
            "health support, reintegration planning, transparency, and dignity-centered storytelling. " +
            $"Current site description: {site.Description ?? "No additional site description provided."}";

        return Task.FromResult(summary);
    }

    public Task<BrandGuidelinesSnapshot> GetBrandGuidelinesAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult(new BrandGuidelinesSnapshot(
            Voice: "Hopeful, respectful, practical, and empowerment-centered.",
            ToneDos:
            [
                "Center dignity, resilience, and agency.",
                "Use trauma-informed language that avoids sensationalism.",
                "Make asks specific, compassionate, and grounded in mission.",
                "Be clear when a recommendation is based on strong evidence versus informed judgment."
            ],
            ToneDonts:
            [
                "Do not use graphic details or shock-based framing.",
                "Do not imply survivors are defined by victimhood alone.",
                "Do not overclaim impact or certainty.",
                "Do not present speculative performance predictions as facts."
            ],
            SafetyRules:
            [
                "Never invent statistics, survivor stories, or sensitive facts.",
                "Never request or reveal personally identifying or case-level details.",
                "Do not include names, ages, exact locations, or identifying timelines.",
                "If context is missing, say that directly and recommend a safe next step."
            ]));
    }

    public Task<SocialMetricsSnapshot> GetRecentSocialMetricsAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult(new SocialMetricsSnapshot(
            EvidenceStrength: "Limited placeholder data for MVP. Replace with live social metrics when available.",
            Highlights:
            [
                "Community education and mission-explainer posts are likely useful early candidates for testing.",
                "Donation, volunteer, and awareness CTAs should be tailored to audience maturity and campaign timing."
            ],
            Gaps:
            [
                "No connected social platform analytics yet.",
                "No recent engagement-by-format benchmark yet.",
                "No historical caption or posting-time performance data yet."
            ]));
    }

    public Task<CausalInsightsSnapshot> GetCausalInsightsAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult(new CausalInsightsSnapshot(
            EvidenceStrength: "Hypothesis-only placeholder for MVP until causal pipeline outputs are connected.",
            Insights:
            [
                "No validated causal findings are connected yet."
            ],
            Hypotheses:
            [
                "Educational storytelling may outperform generic appeals when paired with a concrete next step.",
                "Mission-trust content may support future conversion more effectively than urgent donation asks alone."
            ]));
    }
}
