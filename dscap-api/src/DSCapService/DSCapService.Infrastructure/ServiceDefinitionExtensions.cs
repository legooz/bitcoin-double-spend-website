using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
//using DSCapService.Core.Contracts.RepositoryContracts;
//using DSCapService.Core.Options;
//using DSCapService.Core.Services;
//using DSCapService.Core;
//using DSCapService.Infrastructure.Repositories;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Net.Http.Headers;
using DSCapService.Core.Contracts.RepositoryContracts;
using DSCapService.Infrastructure.Repositories;
using DSCapService.Core.Options;

namespace DSCapService.Infrastructure
{
    public static class ServiceDefinitionExtensions
    {
        public static void AddInfrastructure(this IServiceCollection services, ConfigurationManager configuration)
        {
            AddRepositories(services);
            AddHttpClients(services, configuration);
            AddWebSocketsClients(services, configuration);
        }

        private static void AddRepositories(IServiceCollection services)
        {
            _ = services.AddTransient<ITXRepository, TXRepository>();
        }

        private static void AddHttpClients(IServiceCollection services, ConfigurationManager configuration)
        {
            services.Configure<BTCNodeAddress>(configuration.GetSection(BTCNodeAddress.SectionName));

            _ = services.AddHttpClient("PythonClient", client =>
            {
                var baseAddress = configuration.GetValue<string>("BTCNode:BaseAddress");

                if (baseAddress == null)
                {
                    throw new InvalidOperationException("Missing configuration: BTCNode:BaseAddress");
                }
                client.BaseAddress = new Uri(baseAddress);
                client.DefaultRequestHeaders.Accept.Clear();
                client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            });
        }

        private static void AddWebSocketsClients(IServiceCollection services, ConfigurationManager configuration)
        {
            _ = services.Configure<BTCNodeAddress>(configuration.GetSection(BTCNodeAddress.SectionName));
        }
    }
}