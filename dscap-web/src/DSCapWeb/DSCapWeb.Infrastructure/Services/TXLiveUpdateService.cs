using DSCapWeb.Core.Contracts.ServiceContracts;
using DSCapWeb.Core.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Threading.Tasks;

namespace DSCapWeb.Infrastructure.Services
{
    public class TXLiveUpdateService : ITXLiveUpdateService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        public TXLiveUpdateService(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public async Task StartLiveUpdatesAsync(string transactionId, decimal alpha, CancellationToken cancellationToken = default)
        {
            var request = new StartLiveUpdatesRequestDTO
            {
                Alpha = Math.Round(alpha, 2, MidpointRounding.AwayFromZero)
            };

            var client = _httpClientFactory.CreateClient("ApiClient");

            using var response = await client.PostAsJsonAsync($"transaction/{Uri.EscapeDataString(transactionId)}/live/start", request, cancellationToken);

            response.EnsureSuccessStatusCode();
        }
    }
}
