using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using EbanHaven.Api.Configuration;
using Microsoft.Extensions.Options;

namespace EbanHaven.Api.Admin;

public interface IDonorEmailDeliveryService
{
    Task<SentDonorEmailDto> SendAsync(SendDonorEmailRequest request, CancellationToken cancellationToken);
}

public sealed class DonorEmailDeliveryService(
    IHttpClientFactory httpClientFactory,
    IOptions<GmailOptions> gmailOptions) : IDonorEmailDeliveryService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly GmailOptions _gmail = gmailOptions.Value;

    public async Task<SentDonorEmailDto> SendAsync(SendDonorEmailRequest request, CancellationToken cancellationToken)
    {
        ValidateConfiguration(request);

        var accessToken = await FetchAccessTokenAsync(cancellationToken);
        var rawMessage = BuildRawMimeMessage(request);

        var client = httpClientFactory.CreateClient("GmailApi");
        using var message = new HttpRequestMessage(HttpMethod.Post, "/gmail/v1/users/me/messages/send");
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        message.Content = new StringContent(
            JsonSerializer.Serialize(new { raw = rawMessage }, JsonOptions),
            Encoding.UTF8,
            "application/json");

        using var response = await client.SendAsync(message, cancellationToken);
        var text = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(ExtractError(text, response.ReasonPhrase));

        var parsed = JsonSerializer.Deserialize<GmailSendResponse>(text, JsonOptions);
        return new SentDonorEmailDto(parsed?.Id ?? string.Empty, request.ToEmail.Trim(), DateTimeOffset.UtcNow);
    }

    private void ValidateConfiguration(SendDonorEmailRequest request)
    {
        if (string.IsNullOrWhiteSpace(_gmail.ClientId))
            throw new InvalidOperationException("Gmail is not configured. Set Gmail__ClientId on the API host.");
        if (string.IsNullOrWhiteSpace(_gmail.ClientSecret))
            throw new InvalidOperationException("Gmail is not configured. Set Gmail__ClientSecret on the API host.");
        if (string.IsNullOrWhiteSpace(_gmail.RefreshToken))
            throw new InvalidOperationException("Gmail is not configured. Set Gmail__RefreshToken on the API host.");
        if (string.IsNullOrWhiteSpace(_gmail.SenderEmail))
            throw new InvalidOperationException("Gmail sender is not configured. Set Gmail__SenderEmail on the API host.");
        if (string.IsNullOrWhiteSpace(request.ToEmail))
            throw new InvalidOperationException("A recipient email is required.");
        if (string.IsNullOrWhiteSpace(request.Subject))
            throw new InvalidOperationException("An email subject is required.");
    }

    private async Task<string> FetchAccessTokenAsync(CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient("GoogleOAuth");
        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = _gmail.ClientId.Trim(),
            ["client_secret"] = _gmail.ClientSecret.Trim(),
            ["refresh_token"] = _gmail.RefreshToken.Trim(),
            ["grant_type"] = "refresh_token"
        });

        using var response = await client.PostAsync("/token", content, cancellationToken);
        var text = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(ExtractError(text, response.ReasonPhrase));

        var parsed = JsonSerializer.Deserialize<GoogleTokenResponse>(text, JsonOptions);
        if (string.IsNullOrWhiteSpace(parsed?.AccessToken))
            throw new InvalidOperationException("Google token refresh succeeded but no access token was returned.");

        return parsed.AccessToken;
    }

    private string BuildRawMimeMessage(SendDonorEmailRequest request)
    {
        var boundary = $"mixed_{Guid.NewGuid():N}";
        var from = FormatSender();
        var subject = request.Subject.Trim();
        var to = request.ToEmail.Trim();

        var plainText = request.Body.Replace("\r\n", "\n");
        var html = request.HtmlBody.Replace("\r\n", "\n");

        var mime = new StringBuilder();
        mime.AppendLine($"From: {from}");
        mime.AppendLine($"To: {to}");
        mime.AppendLine($"Subject: {EncodeHeader(subject)}");
        mime.AppendLine("MIME-Version: 1.0");
        mime.AppendLine($"Content-Type: multipart/alternative; boundary=\"{boundary}\"");
        mime.AppendLine();
        mime.AppendLine($"--{boundary}");
        mime.AppendLine("Content-Type: text/plain; charset=\"UTF-8\"");
        mime.AppendLine("Content-Transfer-Encoding: 8bit");
        mime.AppendLine();
        mime.AppendLine(plainText);
        mime.AppendLine();
        mime.AppendLine($"--{boundary}");
        mime.AppendLine("Content-Type: text/html; charset=\"UTF-8\"");
        mime.AppendLine("Content-Transfer-Encoding: 8bit");
        mime.AppendLine();
        mime.AppendLine(html);
        mime.AppendLine();
        mime.AppendLine($"--{boundary}--");

        return Base64UrlEncode(Encoding.UTF8.GetBytes(mime.ToString()));
    }

    private string FormatSender()
    {
        var email = _gmail.SenderEmail.Trim();
        var name = _gmail.SenderName.Trim();
        return string.IsNullOrWhiteSpace(name) ? email : $"\"{name}\" <{email}>";
    }

    private static string EncodeHeader(string value)
    {
        return $"=?UTF-8?B?{Convert.ToBase64String(Encoding.UTF8.GetBytes(value))}?=";
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static string ExtractError(string text, string? fallback)
    {
        try
        {
            using var doc = JsonDocument.Parse(text);
            if (doc.RootElement.TryGetProperty("error_description", out var desc))
                return desc.GetString() ?? fallback ?? "Email send failed.";
            if (doc.RootElement.TryGetProperty("error", out var errorElement))
            {
                if (errorElement.ValueKind == JsonValueKind.String)
                    return errorElement.GetString() ?? fallback ?? "Email send failed.";
                if (errorElement.TryGetProperty("message", out var message))
                    return message.GetString() ?? fallback ?? "Email send failed.";
            }
        }
        catch
        {
            /* ignore */
        }

        return string.IsNullOrWhiteSpace(text) ? (fallback ?? "Email send failed.") : text;
    }

    private sealed class GoogleTokenResponse
    {
        [JsonPropertyName("access_token")]
        public string? AccessToken { get; init; }
    }

    private sealed record GmailSendResponse(string? Id);
}
