using System.Text;
using System.Text.RegularExpressions;
using System.Text.Json;
using EbanHaven.Api.Configuration;
using EbanHaven.Api.Lighthouse;
using Microsoft.Extensions.Options;
using OpenAI.Chat;

namespace EbanHaven.Api.Admin;

public interface IDonorEmailComposer
{
    Task<GeneratedDonorEmailDto> ComposeAsync(
        DonorEmailProfileDto profile,
        GenerateDonorEmailRequest request,
        CancellationToken cancellationToken);
}

public sealed class DonorEmailComposer(
    IOptions<OpenAIOptions> options,
    ILogger<DonorEmailComposer> logger) : IDonorEmailComposer
{
    private const string PublicSiteUrl = "https://eban-haven.vercel.app";
    private const string ImpactUrl = $"{PublicSiteUrl}/impact";
    private const string InfoEmail = "info@ebanhaven.org";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    private readonly OpenAIOptions _options = options.Value;

    public async Task<GeneratedDonorEmailDto> ComposeAsync(
        DonorEmailProfileDto profile,
        GenerateDonorEmailRequest request,
        CancellationToken cancellationToken)
    {
        if (request.PreferAi && !string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            try
            {
                var aiResult = await ComposeWithAiAsync(profile, request, cancellationToken);
                if (aiResult is not null)
                    return aiResult with { UsedAi = true, Strategy = "AI-generated from donor history" };
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Falling back to template donor email generation for supporter {SupporterId}.", profile.Supporter.Id);
            }
        }

        return BuildTemplate(profile, request);
    }

    private async Task<GeneratedDonorEmailDto?> ComposeWithAiAsync(
        DonorEmailProfileDto profile,
        GenerateDonorEmailRequest request,
        CancellationToken cancellationToken)
    {
        var client = new ChatClient(_options.Model, _options.ApiKey);
        var completion = await client.CompleteChatAsync(
            [
                new SystemChatMessage(BuildSystemPrompt()),
                new UserChatMessage(BuildUserPrompt(profile, request))
            ],
            cancellationToken: cancellationToken);

        var rawText = string.Join(
            "\n",
            completion.Value.Content
                .Select(static item => item.Text)
                .Where(static text => !string.IsNullOrWhiteSpace(text)));

        var json = ExtractJson(rawText);
        var parsed = JsonSerializer.Deserialize<DonorEmailModelReply>(json, JsonOptions);
        if (parsed is null || string.IsNullOrWhiteSpace(parsed.Subject) || string.IsNullOrWhiteSpace(parsed.Body))
            return null;

        var subject = NormalizeSingleLine(parsed.Subject);
        var preview = NormalizeSingleLine(parsed.Preview);
        var body = NormalizeBody(parsed.Body, request);
        return new GeneratedDonorEmailDto(
            subject,
            preview,
            body,
            BuildHtmlEmail(subject, preview, body, request),
            UsedAi: true,
            Strategy: "AI-generated from donor history");
    }

    private static string BuildSystemPrompt()
    {
        return """
            You write stewardship emails for a nonprofit administrator.
            Use only the donor facts provided. Do not invent gifts, campaigns, impact claims, family details, or promises.
            Keep the message personal, warm, concise, and ready to send.
            Write polished plain text email copy only.
            Do not use markdown, bullets, asterisks, plus signs instead of spaces, placeholder tags, or bracketed tokens.
            Mention concrete giving history only when supported by the provided data.
            If a value is missing, work around it naturally instead of guessing.
            Avoid manipulative guilt language.
            Include a complete, professional sign-off using the provided sender details.

            Return valid JSON only:
            {
              "subject": "",
              "preview": "",
              "body": ""
            }
            """;
    }

    private static string BuildUserPrompt(DonorEmailProfileDto profile, GenerateDonorEmailRequest request)
    {
        var payload = new
        {
            goal = string.IsNullOrWhiteSpace(request.Goal) ? "Thank the donor and encourage their next step." : request.Goal.Trim(),
            tone = string.IsNullOrWhiteSpace(request.Tone) ? "Warm" : request.Tone.Trim(),
            sender = new
            {
                name = request.SenderName?.Trim(),
                title = request.SenderTitle?.Trim(),
                organization = request.SenderOrganization?.Trim(),
                contact = request.SenderContact?.Trim()
            },
            donor = profile
        };

        return JsonSerializer.Serialize(payload, JsonOptions);
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

    private static GeneratedDonorEmailDto BuildTemplate(DonorEmailProfileDto profile, GenerateDonorEmailRequest request)
    {
        var donorName = FirstNameOrDisplayName(profile.Supporter);
        var goal = string.IsNullOrWhiteSpace(request.Goal) ? "Thank the donor and encourage their next step." : request.Goal.Trim();
        var tone = string.IsNullOrWhiteSpace(request.Tone) ? "Warm" : request.Tone.Trim();
        var subject = BuildSubject(profile, goal);
        var preview = BuildPreview(profile);

        var body = new StringBuilder();
        body.AppendLine($"Hi {donorName},");
        body.AppendLine();
        body.AppendLine(BuildOpening(profile, goal, tone));
        body.AppendLine();
        body.AppendLine(BuildHistoryParagraph(profile));
        body.AppendLine();
        body.AppendLine(BuildNextStepParagraph(profile, goal));
        body.AppendLine();
        AppendSignature(body, request);

        var normalizedSubject = NormalizeSingleLine(subject);
        var normalizedPreview = NormalizeSingleLine(preview);
        var normalizedBody = NormalizeBody(body.ToString(), request);
        return new GeneratedDonorEmailDto(
            normalizedSubject,
            normalizedPreview,
            normalizedBody,
            BuildHtmlEmail(normalizedSubject, normalizedPreview, normalizedBody, request),
            UsedAi: false,
            Strategy: "Template generated from donor history");
    }

    private static string BuildSubject(DonorEmailProfileDto profile, string goal)
    {
        var name = FirstNameOrDisplayName(profile.Supporter);
        if (goal.Contains("re-engage", StringComparison.OrdinalIgnoreCase) || goal.Contains("return", StringComparison.OrdinalIgnoreCase))
            return $"{name}, we would love to reconnect";
        if (goal.Contains("monthly", StringComparison.OrdinalIgnoreCase) || goal.Contains("recurring", StringComparison.OrdinalIgnoreCase))
            return $"{name}, thank you for standing with us";
        return $"Thank you, {name}";
    }

    private static string BuildPreview(DonorEmailProfileDto profile)
    {
        if (profile.MostRecentDonationDate is not null)
            return $"A personal note inspired by your support through {profile.MostRecentDonationDate.Value:MMMM yyyy}.";

        return "A personal thank-you and next-step note for this donor relationship.";
    }

    private static string BuildOpening(DonorEmailProfileDto profile, string goal, string tone)
    {
        var summary = profile.RelationshipSummary;
        if (goal.Contains("re-engage", StringComparison.OrdinalIgnoreCase))
            return $"I wanted to reach out with a quick note of thanks and to reconnect. {summary}";

        if (tone.Contains("direct", StringComparison.OrdinalIgnoreCase))
            return $"Thank you for your support. {summary}";

        return $"I wanted to send a personal note of thanks. {summary}";
    }

    private static string BuildHistoryParagraph(DonorEmailProfileDto profile)
    {
        var details = new List<string>();

        if (profile.DonationCount > 0)
            details.Add($"{profile.DonationCount} recorded gift{(profile.DonationCount == 1 ? string.Empty : "s")}");

        if (profile.LifetimeMonetaryTotal > 0)
            details.Add($"lifetime monetary giving of {FormatMoney(profile.LifetimeMonetaryTotal, profile.PreferredCurrencyCode)}");

        if (profile.ProgramAreas.Count > 0)
            details.Add($"recent support connected to {JoinHuman(profile.ProgramAreas.Take(3))}");

        if (details.Count == 0)
            return "Your presence in our community matters, and we are grateful to have you in this work with us.";

        return $"We are grateful for {JoinHuman(details)}. Every act of support helps us keep showing up with care and consistency.";
    }

    private static string BuildNextStepParagraph(DonorEmailProfileDto profile, string goal)
    {
        if (goal.Contains("monthly", StringComparison.OrdinalIgnoreCase) || goal.Contains("recurring", StringComparison.OrdinalIgnoreCase))
            return "If you are open to it, a recurring gift would help us plan ahead and respond more steadily to needs as they arise.";

        if (goal.Contains("update", StringComparison.OrdinalIgnoreCase) || goal.Contains("impact", StringComparison.OrdinalIgnoreCase))
            return "If helpful, I would be glad to share a short update on how current support is being directed and where needs are growing right now.";

        if (goal.Contains("re-engage", StringComparison.OrdinalIgnoreCase))
            return "If you would like to reconnect, we would be grateful to have you involved again in whatever way feels right to you.";

        if (profile.ProgramAreas.Count > 0)
            return $"If you would like, I can also share more about current needs in {JoinHuman(profile.ProgramAreas.Take(2))}.";

        return "If you would like, I can share a quick update on current needs and where support is making a difference right now.";
    }

    private static string FirstNameOrDisplayName(SupporterDto supporter)
    {
        if (!string.IsNullOrWhiteSpace(supporter.FirstName))
            return supporter.FirstName.Trim();
        if (!string.IsNullOrWhiteSpace(supporter.DisplayName))
            return supporter.DisplayName.Trim();
        return "there";
    }

    private static string FormatMoney(decimal amount, string currencyCode)
    {
        if (currencyCode.Equals("PHP", StringComparison.OrdinalIgnoreCase))
            return $"PHP {amount:N2}";
        if (currencyCode.Equals("USD", StringComparison.OrdinalIgnoreCase))
            return $"USD {amount:N2}";

        try
        {
            return $"{currencyCode} {amount:N2}";
        }
        catch
        {
            return $"{amount:0.##} {currencyCode}";
        }
    }

    private static string JoinHuman(IEnumerable<string> items)
    {
        var parts = items.Where(static item => !string.IsNullOrWhiteSpace(item)).Select(static item => item.Trim()).Distinct().ToArray();
        return parts.Length switch
        {
            0 => string.Empty,
            1 => parts[0],
            2 => $"{parts[0]} and {parts[1]}",
            _ => $"{string.Join(", ", parts[..^1])}, and {parts[^1]}"
        };
    }

    private static void AppendSignature(StringBuilder body, GenerateDonorEmailRequest request)
    {
        body.AppendLine("With gratitude,");

        var signatureLines = new[]
        {
            request.SenderName?.Trim(),
            request.SenderTitle?.Trim(),
            request.SenderOrganization?.Trim(),
            request.SenderContact?.Trim()
        }
        .Where(static line => !string.IsNullOrWhiteSpace(line))
        .ToArray();

        if (signatureLines.Length == 0)
        {
            body.AppendLine("The Eban Haven Team");
            return;
        }

        foreach (var line in signatureLines)
            body.AppendLine(line);
    }

    private static string NormalizeSingleLine(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;

        var normalized = value
            .Replace('+', ' ')
            .Replace("**", string.Empty)
            .Replace("__", string.Empty)
            .Replace("\r", " ")
            .Replace("\n", " ");

        normalized = Regex.Replace(normalized, "\\s+", " ").Trim();
        return normalized;
    }

    private static string NormalizeBody(string? value, GenerateDonorEmailRequest request)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;

        var normalized = value
            .Replace("\r\n", "\n")
            .Replace('\r', '\n')
            .Replace('+', ' ')
            .Replace("**", string.Empty)
            .Replace("__", string.Empty);

        normalized = Regex.Replace(normalized, @"[ \t]+\n", "\n");
        normalized = Regex.Replace(normalized, @"\n{3,}", "\n\n");
        normalized = Regex.Replace(normalized, @"[ \t]{2,}", " ");

        normalized = Regex.Replace(
            normalized,
            @"(?im)^\s*\[(your|sender|organization|contact)[^\]]*\]\s*$",
            string.Empty);
        normalized = Regex.Replace(
            normalized,
            @"(?im)^\s*\[.*?(name|title|organization|contact).*?\]\s*$",
            string.Empty);
        normalized = Regex.Replace(normalized, @"\n{3,}", "\n\n");

        var signatureLines = new[]
        {
            request.SenderName?.Trim(),
            request.SenderTitle?.Trim(),
            request.SenderOrganization?.Trim(),
            request.SenderContact?.Trim()
        }
        .Where(static line => !string.IsNullOrWhiteSpace(line))
        .ToArray();

        if (signatureLines.Length > 0)
        {
            var signatureBlock = string.Join("\n", signatureLines);
            if (!normalized.Contains(signatureBlock, StringComparison.OrdinalIgnoreCase))
            {
                normalized = normalized.TrimEnd();
                normalized += "\n\nWith gratitude,\n" + signatureBlock;
            }
        }
        else if (!normalized.Contains("The Eban Haven Team", StringComparison.OrdinalIgnoreCase))
        {
            normalized = normalized.TrimEnd() + "\n\nWith gratitude,\nThe Eban Haven Team";
        }

        return normalized.Trim();
    }

    private static string BuildHtmlEmail(
        string subject,
        string preview,
        string body,
        GenerateDonorEmailRequest request)
    {
        var signatureLines = new[]
        {
            request.SenderName?.Trim(),
            request.SenderTitle?.Trim(),
            request.SenderOrganization?.Trim(),
            request.SenderContact?.Trim()
        }
        .Where(static line => !string.IsNullOrWhiteSpace(line))
        .Select(static line => line!)
        .DefaultIfEmpty("The Eban Haven Team")
        .ToArray();

        var bodyWithoutSignature = RemoveSignatureBlock(body, signatureLines);
        var paragraphs = bodyWithoutSignature
            .Split("\n\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(paragraph => EscapeHtml(paragraph).Replace("\n", "<br/>"))
            .ToArray();

        var paragraphHtml = string.Join(
            "\n",
            paragraphs.Select(static paragraph => $"<p style=\"margin:0 0 18px;color:#30434a;font-size:16px;line-height:1.7;\">{paragraph}</p>"));

        var signatureHtml = string.Join(
            "<br/>",
            signatureLines.Select(EscapeHtml));

        var heroImageUrl = $"{PublicSiteUrl}/logo_transparent.png";

        return $"""
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4efe8;font-family:Georgia,'Times New Roman',serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">{EscapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4efe8;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffdf9;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(61,47,32,.12);">
            <tr>
              <td style="background:linear-gradient(135deg,#114b5f 0%,#1f7a8c 55%,#f2c14e 100%);padding:28px 36px;">
                <img src="{heroImageUrl}" alt="Eban Haven" style="display:block;width:120px;max-width:120px;height:auto;margin-bottom:18px;" />
                <div style="color:#fff7ec;font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-family:Arial,sans-serif;">Eban Haven</div>
                <h1 style="margin:10px 0 0;color:white;font-size:30px;line-height:1.2;font-weight:700;">{EscapeHtml(subject)}</h1>
                <p style="margin:12px 0 0;color:rgba(255,247,236,.9);font-size:15px;line-height:1.6;font-family:Arial,sans-serif;">{EscapeHtml(preview)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:36px;">
                {paragraphHtml}
                <div style="margin:28px 0 0;padding:24px;border-radius:18px;background:#f7f3ed;border:1px solid #eadfce;">
                  <p style="margin:0 0 14px;color:#7a5c2e;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-family:Arial,sans-serif;">Stay Connected</p>
                  <p style="margin:0 0 18px;color:#30434a;font-size:15px;line-height:1.7;">Learn more about the programs and impact your support helps sustain.</p>
                  <a href="{ImpactUrl}" style="display:inline-block;background:#114b5f;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:999px;font-size:14px;font-weight:700;font-family:Arial,sans-serif;">View Our Impact</a>
                  <p style="margin:16px 0 0;color:#6a7b80;font-size:13px;line-height:1.6;font-family:Arial,sans-serif;">Website: <a href="{PublicSiteUrl}" style="color:#114b5f;">{PublicSiteUrl}</a><br/>Contact: <a href="mailto:{InfoEmail}" style="color:#114b5f;">{InfoEmail}</a></p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 36px;">
                <div style="padding-top:22px;border-top:1px solid #eadfce;color:#5f6d72;font-size:14px;line-height:1.7;font-family:Arial,sans-serif;">
                  {signatureHtml}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""";
    }

    private static string EscapeHtml(string? value)
    {
        return System.Net.WebUtility.HtmlEncode(value ?? string.Empty);
    }

    private static string RemoveSignatureBlock(string body, IReadOnlyList<string> signatureLines)
    {
        var signatureBlock = "With gratitude,\n" + string.Join("\n", signatureLines);
        if (body.EndsWith(signatureBlock, StringComparison.OrdinalIgnoreCase))
            return body[..^signatureBlock.Length].TrimEnd();

        return body;
    }

    private sealed class DonorEmailModelReply
    {
        public string? Subject { get; init; }
        public string? Preview { get; init; }
        public string? Body { get; init; }
    }
}
