using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using EbanHaven.Api.Configuration;
using Microsoft.Extensions.Options;

namespace EbanHaven.Api.Admin;

public interface IDonorEmailDeliveryService
{
    Task<SentDonorEmailDto> SendAsync(SendDonorEmailRequest request, CancellationToken cancellationToken);
}

public sealed class DonorEmailDeliveryService(
    IHttpClientFactory httpClientFactory,
    IOptions<ResendOptions> options) : IDonorEmailDeliveryService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly ResendOptions _options = options.Value;

    public async Task<SentDonorEmailDto> SendAsync(SendDonorEmailRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
            throw new InvalidOperationException("Resend is not configured. Set Resend__ApiKey on the API host.");
        if (string.IsNullOrWhiteSpace(_options.FromEmail))
            throw new InvalidOperationException("Resend sender is not configured. Set Resend__FromEmail on the API host.");
        if (string.IsNullOrWhiteSpace(request.ToEmail))
            throw new InvalidOperationException("A recipient email is required.");
        if (string.IsNullOrWhiteSpace(request.Subject))
            throw new InvalidOperationException("An email subject is required.");

        var client = httpClientFactory.CreateClient("Resend");
        using var message = new HttpRequestMessage(HttpMethod.Post, "/emails");
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

        var payload = new
        {
            from = FormatFromAddress(),
            to = new[] { request.ToEmail.Trim() },
            subject = request.Subject.Trim(),
            html = request.HtmlBody,
            text = request.Body,
            reply_to = string.IsNullOrWhiteSpace(_options.ReplyToEmail) ? null : _options.ReplyToEmail.Trim()
        };

        message.Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(message, cancellationToken);
        var text = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(ExtractError(text, response.ReasonPhrase));

        var parsed = JsonSerializer.Deserialize<ResendSendResponse>(text, JsonOptions);
        return new SentDonorEmailDto(
            parsed?.Id ?? string.Empty,
            request.ToEmail.Trim(),
            DateTimeOffset.UtcNow);
    }

    private string FormatFromAddress()
    {
        var email = _options.FromEmail.Trim();
        var name = _options.FromName.Trim();
        return string.IsNullOrWhiteSpace(name) ? email : $"{name} <{email}>";
    }

    private static string ExtractError(string text, string? fallback)
    {
        try
        {
            var parsed = JsonSerializer.Deserialize<ResendErrorResponse>(text, JsonOptions);
            if (!string.IsNullOrWhiteSpace(parsed?.Message))
                return parsed.Message.Trim();
        }
        catch
        {
            /* ignore */
        }

        return string.IsNullOrWhiteSpace(text) ? (fallback ?? "Email send failed.") : text;
    }

    private sealed record ResendSendResponse(string? Id);
    private sealed record ResendErrorResponse(string? Message);
}
