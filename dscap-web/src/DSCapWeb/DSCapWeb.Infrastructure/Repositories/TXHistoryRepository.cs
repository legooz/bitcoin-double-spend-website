using DSCapWeb.Core.Contracts.RepositoryContracts;
using DSCapWeb.Core.Models;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace DSCapWeb.Infrastructure.Repositories
{
    class TXHistoryRepository : ITXHistoryRepository
    {
        private readonly IHttpClientFactory _httpClientFactory;
        public TXHistoryRepository(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public async Task<TransactionHistoryResponseDTO?> GetTransactionHistoryAsync(string transactionId, decimal alpha, int lttbThreshold)
        {
            var client = _httpClientFactory.CreateClient("ApiClient");

            var formattedAlpha = Math.Round(alpha, 2, MidpointRounding.AwayFromZero).ToString("F2", CultureInfo.InvariantCulture);

            var response = await client.GetAsync(
                $"transaction/{Uri.EscapeDataString(transactionId)}/history" +
                $"?alpha={Uri.EscapeDataString(formattedAlpha)}" +
                $"&lttbThreshold={lttbThreshold}");

            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var json = await response.Content.ReadAsStringAsync();

            return JsonSerializer.Deserialize<TransactionHistoryResponseDTO>(
                json,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
        }
    }
}
