using DSCapWeb.Core.Contracts.RepositoryContracts;
using DSCapWeb.Core.Models;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Transactions;

namespace DSCapWeb.Infrastructure.Repositories
{
    public class TXSummaryRepository : ITXSummaryRepository
    {
        private readonly IHttpClientFactory _httpClientFactory;
        public TXSummaryRepository(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public async Task<BtcTransactionDTO?> GetTXSummaryAsync(string txId, decimal alpha)
        {
            var client = _httpClientFactory.CreateClient("ApiClient");

            var formattedAlpha = Math.Round(alpha, 2, MidpointRounding.AwayFromZero).ToString("F2", CultureInfo.InvariantCulture);
            var url =$"transaction/{Uri.EscapeDataString(txId)}?alpha={Uri.EscapeDataString(formattedAlpha)}";

            using var response = await client.GetAsync(url);

            if (!response.IsSuccessStatusCode)
                return null;

            response.EnsureSuccessStatusCode();

            return await response.Content.ReadFromJsonAsync<BtcTransactionDTO>();
        }
    }
}
