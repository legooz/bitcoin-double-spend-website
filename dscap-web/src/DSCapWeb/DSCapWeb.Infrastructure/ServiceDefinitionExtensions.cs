using DSCapWeb.Core.Contracts.RepositoryContracts;
using DSCapWeb.Infrastructure.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Http.Headers;
using System.Threading;

namespace DSCapWeb.Infrastructure
{
    public static class ServiceDefinitionExtensions
    {
        public static void AddInfrastructure(this IServiceCollection service, ConfigurationManager configuration)
        {
            AddRepositories(service);
            AddHttpClients(service, configuration);
        }

        private static void AddRepositories(IServiceCollection services)
        {
            _ = services.AddTransient<ITXSummaryRepository, TXSummaryRepository>();
            _ = services.AddTransient<ITXHistoryRepository, TXHistoryRepository>();
        }

        private static void AddHttpClients(IServiceCollection services, ConfigurationManager configuration)
        {
            var baseAddress = configuration.GetValue<string>("DSCapWebSettings:ApiBaseUrl");

            if (string.IsNullOrWhiteSpace(baseAddress))
                throw new InvalidOperationException("Missing DSCapWebSettings:ApiBaseUrl");

            _ = services.AddHttpClient("ApiClient", client =>
            {
                client.BaseAddress = new Uri(baseAddress);
                client.DefaultRequestHeaders.Accept.Clear();
                client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                client.Timeout = Timeout.InfiniteTimeSpan;
            });
        }
    }
}