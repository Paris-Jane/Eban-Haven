using System.Text;
using System.Text.Json;
using EbanHaven.Api.Configuration;
using Microsoft.Extensions.Options;
using OpenAI.Chat;

namespace EbanHaven.Api.SocialChat;

public interface ISocialChatService
{
    Task<SocialChatResponse> GetReplyAsync(SocialChatRequest request, CancellationToken cancellationToken);
}

public sealed class OpenAISocialChatService(
    ISocialChatContextService contextService,
    IOptions<OpenAIOptions> options,
    ILogger<OpenAISocialChatService> logger) : ISocialChatService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly OpenAIOptions _options = options.Value;

    public async Task<SocialChatResponse> GetReplyAsync(SocialChatRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
            throw new InvalidOperationException(
                "The backend is missing OpenAI credentials. Set OpenAI__ApiKey on the API host.");

        var context = await contextService.BuildContextAsync(cancellationToken);
        var conversation = NormalizeMessages(request.Messages);
        var currentUserMessage = conversation.LastOrDefault(m => m.Role == "user")?.Content;

        if (string.IsNullOrWhiteSpace(currentUserMessage))
            throw new InvalidOperationException("Please send a question or planning request.");

        var systemPrompt = BuildSystemPrompt();
        var userPrompt = BuildUserPrompt(conversation, context);
        var chatClient = new ChatClient(_options.Model, _options.ApiKey);

        var completion = await chatClient.CompleteChatAsync(
            [
                new SystemChatMessage(systemPrompt),
                new UserChatMessage(userPrompt)
            ],
            cancellationToken: cancellationToken);

        var rawText = string.Join(
            "\n",
            completion.Value.Content
                .Select(static item => item.Text)
                .Where(static text => !string.IsNullOrWhiteSpace(text)));

        var structured = ParseStructuredReply(rawText, logger);
        var message = BuildDisplayMessage(structured);

        return new SocialChatResponse(
            Message: message,
            Structured: structured,
            Context: context,
            Model: _options.Model,
            GeneratedAtUtc: DateTimeOffset.UtcNow);
    }

    private static IReadOnlyList<SocialChatMessageDto> NormalizeMessages(IReadOnlyList<SocialChatMessageDto>? messages)
    {
        return messages?
            .Where(static message =>
                !string.IsNullOrWhiteSpace(message.Role) &&
                !string.IsNullOrWhiteSpace(message.Content))
            .TakeLast(10)
            .Select(message => new SocialChatMessageDto(message.Role.Trim().ToLowerInvariant(), message.Content.Trim()))
            .ToArray()
            ?? [];
    }

    private static string BuildSystemPrompt()
    {
        return """
            You are a social media planning assistant for a nonprofit that supports women and girls in Ghana affected by trafficking and sexual violence.
            Help administrators plan ethical, trauma-informed social media content.
            Base recommendations only on website content, brand guidance, social metrics, and causal insights provided by the application.
            Do not invent facts, statistics, survivor stories, testimonials, or sensitive details.
            Do not request or expose personally identifying information or case-level data.
            Prefer respectful, empowerment-centered language over sensational or pity-driven language.
            Clearly separate strong evidence from limited evidence, assumptions, and hypotheses.
            If evidence is weak or missing, say so plainly.

            Return valid JSON only with this shape:
            {
              "postIdeas": [{ "title": "", "format": "", "caption": "", "cta": "", "bestTime": "", "whyItFits": "" }],
              "captions": [""],
              "timingRecommendations": [{ "recommendation": "", "rationale": "" }],
              "ctaRecommendations": [{ "recommendation": "", "rationale": "" }],
              "confidenceNotes": [{ "label": "", "detail": "" }],
              "reasoning": [""]
            }

            Keep lists concise and practical for an administrator.
            """;
    }

    private static string BuildUserPrompt(
        IReadOnlyList<SocialChatMessageDto> conversation,
        SocialChatContextSnapshot context)
    {
        var payload = new
        {
            context,
            conversation
        };

        return JsonSerializer.Serialize(payload, JsonOptions);
    }

    private static SocialChatStructuredReply ParseStructuredReply(string rawText, ILogger logger)
    {
        try
        {
            var json = ExtractJson(rawText);
            var parsed = JsonSerializer.Deserialize<SocialChatModelReply>(json, JsonOptions);
            if (parsed is null)
                throw new JsonException("Model reply was empty.");

            return new SocialChatStructuredReply(
                PostIdeas: parsed.PostIdeas ?? [],
                Captions: parsed.Captions ?? [],
                TimingRecommendations: parsed.TimingRecommendations ?? [],
                CtaRecommendations: parsed.CtaRecommendations ?? [],
                ConfidenceNotes: parsed.ConfidenceNotes ?? [],
                Reasoning: parsed.Reasoning ?? []);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Falling back to plain-text social chat parsing.");
            return new SocialChatStructuredReply(
                PostIdeas: [],
                Captions: [],
                TimingRecommendations: [],
                CtaRecommendations: [],
                ConfidenceNotes:
                [
                    new ConfidenceNote(
                        "Parsing fallback",
                        "The model response could not be parsed into structured JSON, so the raw response was returned.")
                ],
                Reasoning: [rawText.Trim()]);
        }
    }

    private static string ExtractJson(string rawText)
    {
        var trimmed = rawText.Trim();
        if (trimmed.StartsWith("```", StringComparison.Ordinal))
        {
            var lines = trimmed.Split('\n').ToList();
            if (lines.Count >= 2)
            {
                lines.RemoveAt(0);
                if (lines.Count > 0 && lines[^1].Trim() == "```")
                    lines.RemoveAt(lines.Count - 1);
                trimmed = string.Join('\n', lines).Trim();
            }
        }

        var start = trimmed.IndexOf('{');
        var end = trimmed.LastIndexOf('}');
        if (start >= 0 && end > start)
            return trimmed[start..(end + 1)];

        return trimmed;
    }

    private static string BuildDisplayMessage(SocialChatStructuredReply structured)
    {
        var sb = new StringBuilder();

        if (structured.PostIdeas.Count > 0)
        {
            sb.AppendLine("Here are a few social content directions to review:");
            foreach (var idea in structured.PostIdeas.Take(3))
                sb.AppendLine($"- {idea.Title}: {idea.WhyItFits}");
        }

        if (structured.ConfidenceNotes.Count > 0)
        {
            if (sb.Length > 0)
                sb.AppendLine();
            sb.AppendLine("Confidence notes:");
            foreach (var note in structured.ConfidenceNotes.Take(3))
                sb.AppendLine($"- {note.Label}: {note.Detail}");
        }

        if (sb.Length == 0 && structured.Reasoning.Count > 0)
            return string.Join("\n", structured.Reasoning);

        return sb.ToString().Trim();
    }

    private sealed class SocialChatModelReply
    {
        public List<SocialChatSuggestion>? PostIdeas { get; init; }

        public List<string>? Captions { get; init; }

        public List<RecommendationItem>? TimingRecommendations { get; init; }

        public List<RecommendationItem>? CtaRecommendations { get; init; }

        public List<ConfidenceNote>? ConfidenceNotes { get; init; }

        public List<string>? Reasoning { get; init; }
    }
}
