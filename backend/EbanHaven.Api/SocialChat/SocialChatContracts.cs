namespace EbanHaven.Api.SocialChat;

public sealed record SocialChatRequest(IReadOnlyList<SocialChatMessageDto>? Messages);

public sealed record SocialChatMessageDto(string Role, string Content);

public sealed record SocialChatResponse(
    string Message,
    SocialChatStructuredReply Structured,
    SocialChatContextSnapshot Context,
    string Model,
    DateTimeOffset GeneratedAtUtc);

public sealed record SocialChatStructuredReply(
    IReadOnlyList<SocialChatSuggestion> PostIdeas,
    IReadOnlyList<string> Captions,
    IReadOnlyList<RecommendationItem> TimingRecommendations,
    IReadOnlyList<RecommendationItem> CtaRecommendations,
    IReadOnlyList<ConfidenceNote> ConfidenceNotes,
    IReadOnlyList<string> Reasoning);

public sealed record SocialChatSuggestion(
    string Title,
    string Format,
    string Caption,
    string Cta,
    string BestTime,
    string WhyItFits);

public sealed record RecommendationItem(string Recommendation, string Rationale);

public sealed record ConfidenceNote(string Label, string Detail);

public sealed record SocialChatContextSnapshot(
    string WebsiteSummary,
    BrandGuidelinesSnapshot BrandGuidelines,
    SocialMetricsSnapshot RecentSocialMetrics,
    CausalInsightsSnapshot CausalInsights);

public sealed record BrandGuidelinesSnapshot(
    string Voice,
    IReadOnlyList<string> ToneDos,
    IReadOnlyList<string> ToneDonts,
    IReadOnlyList<string> SafetyRules);

public sealed record SocialMetricsSnapshot(
    string EvidenceStrength,
    IReadOnlyList<string> Highlights,
    IReadOnlyList<string> Gaps);

public sealed record CausalInsightsSnapshot(
    string EvidenceStrength,
    IReadOnlyList<string> Insights,
    IReadOnlyList<string> Hypotheses);
