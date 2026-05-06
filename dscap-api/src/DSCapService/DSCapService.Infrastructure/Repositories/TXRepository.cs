using DSCapService.Core.Contracts.RepositoryContracts;
using DSCapService.Core.Helpers;
using DSCapService.Core.Models.DTOs;
using DSCapService.Core.Options;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace DSCapService.Infrastructure.Repositories
{
    public class TXRepository : ITXRepository
    {
        private readonly HttpClient _http;
        private readonly BTCNodeAddress _options;
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        public TXRepository(IHttpClientFactory http, IOptions<BTCNodeAddress> options)
        {
            _http = http.CreateClient("PythonClient");
            _options = options.Value;
        }

        public async Task<BtcTransactionDTO?> GetTransaction(string transactionId, decimal alpha)
        {
            var formattedAlpha = TransactionSubscriptionHelper.FormatAlpha(alpha);

            var url =$"/transaction?txid={Uri.EscapeDataString(transactionId)}&alpha={Uri.EscapeDataString(formattedAlpha)}";

            using var response = await _http.GetAsync(url);

            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return null;
            }

            response.EnsureSuccessStatusCode();

            return await response.Content.ReadFromJsonAsync<BtcTransactionDTO>();
        }

        public async Task<TransactionHistoryRawDTO?> GetTransactionHistory(string transactionId, decimal alpha, int lttbThreshold)
        {
            var formattedAlpha = TransactionSubscriptionHelper.FormatAlpha(alpha);

            var url = $"/transaction/probability-history?txid={Uri.EscapeDataString(transactionId)}&alpha={Uri.EscapeDataString(formattedAlpha)}&lttb_threshold={lttbThreshold}";

            using var response = await _http.GetAsync(url);

            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return null;
            }

            response.EnsureSuccessStatusCode();

            return await response.Content.ReadFromJsonAsync<TransactionHistoryRawDTO?>();
        }

        public async Task<TransactionUpdateProbeDTO?> GetLiveUpdateAsync(string transactionId, decimal alpha, CancellationToken cancellationToken = default)
        {
            var wsUri = BuildProbabilityUri(transactionId, alpha);

            using var ws = new ClientWebSocket();

            await ws.ConnectAsync(wsUri, cancellationToken);

            var dto = await ReceiveSingleUpdateAsync(ws, cancellationToken);

            if (ws.State == WebSocketState.Open || ws.State == WebSocketState.CloseReceived)
            {
                await ws.CloseAsync(
                    WebSocketCloseStatus.NormalClosure,
                    "Client closing after first update",
                    cancellationToken);
            }

            return dto;
        }

        public async Task StreamLiveUpdatesAsync(string transactionId, decimal alpha, Func<TransactionUpdateProbeDTO, Task> onUpdate, CancellationToken cancellationToken = default)
        {
            var wsUri = BuildProbabilityUri(transactionId, alpha);

            using var ws = new ClientWebSocket();

            await ws.ConnectAsync(wsUri, cancellationToken);

            try
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    var dto = await ReceiveSingleUpdateAsync(ws, cancellationToken);

                    if (dto is null)
                    {
                        break;
                    }

                    await onUpdate(dto);
                }
            }
            finally
            {
                if (ws.State == WebSocketState.Open || ws.State == WebSocketState.CloseReceived)
                {
                    await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Client closing stream", CancellationToken.None);
                }
            }
        }

        private static async Task<TransactionUpdateProbeDTO?> ReceiveSingleUpdateAsync(ClientWebSocket ws, CancellationToken cancellationToken)
        {
            var buffer = new byte[4096];
            using var ms = new MemoryStream();

            while (true)
            {
                var result = await ws.ReceiveAsync(buffer, cancellationToken);

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    return null;
                }

                ms.Write(buffer, 0, result.Count);

                if (result.EndOfMessage)
                {
                    break;
                }
            }

            var json = Encoding.UTF8.GetString(ms.ToArray());

            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            return JsonSerializer.Deserialize<TransactionUpdateProbeDTO>(json, _jsonOptions);
        }

        private Uri BuildProbabilityUri(string transactionId, decimal alpha)
        {
            var formattedAlpha = TransactionSubscriptionHelper.FormatAlpha(alpha);

            return new Uri($"{_options.WebSocketBaseAddress.TrimEnd('/')}/probability/{Uri.EscapeDataString(transactionId)}/{Uri.EscapeDataString(formattedAlpha)}");
        }
    }
}
